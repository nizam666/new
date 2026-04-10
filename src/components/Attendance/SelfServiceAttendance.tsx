import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, LogIn, LogOut, CheckCircle, AlertCircle } from 'lucide-react';

type AttendanceStatus = 'idle' | 'loading' | 'success' | 'error';
type ActionType = 'punch_in' | 'punch_out';

type WorkArea = 'quarry' | 'crusher' | 'general';

interface SelfServiceAttendanceProps {
  workArea?: WorkArea;
}

export function SelfServiceAttendance({ workArea = 'general' }: SelfServiceAttendanceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      streamRef.current = newStream;
      setHasCameraAccess(true);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setHasCameraAccess(false);
      setStatusMessage("Could not access camera. Please check permissions.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const formatErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && err !== null) {
      const e = err as any;
      return e.message || e.error_description || e.error || e.details || e.hint || e.msg || JSON.stringify(err);
    }
    return String(err);
  };

  const getCurrentLocation = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('Geolocation not supported');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        },
        (error) => {
          console.error('Geolocation error:', error);
          resolve('Location denied');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const capturePhoto = useCallback((): Blob | null => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      if (width === 0 || height === 0) {
        throw new Error('Camera feed is not ready yet. Please wait a moment and try again.');
      }

      canvas.width = width;
      canvas.height = height;
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Cannot access camera canvas context.');
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Preview
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);

      // For upload
      const data = dataUrl.split(',')[1];
      const bytes = atob(data);
      const array = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        array[i] = bytes.charCodeAt(i);
      }
      return new Blob([array], { type: 'image/jpeg' });
    }
    throw new Error('Camera or canvas is unavailable.');
  }, []);

  const uploadPhoto = async (blob: Blob, empId: string, action: ActionType): Promise<string> => {
    const timestamp = new Date().getTime();
    const fileName = `${empId}_${action}_${timestamp}.jpg`;
    
    const { error: uploadError } = await supabase.storage
      .from('attendance-photos')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage Upload Error Detail:', uploadError);
      throw new Error(`Storage Upload Error: ${formatErrorMessage(uploadError)}`);
    }
    
    const { data: publicData } = supabase.storage
      .from('attendance-photos')
      .getPublicUrl(fileName);

    if (!publicData?.publicUrl) {
      throw new Error('Unable to generate public URL for attendance photo.');
    }
      
    return publicData.publicUrl;
  };

  const handleAttendance = async (action: ActionType) => {
    setCapturedPhoto(null);
    setStatus('loading');
    setStatusMessage('');

    if (!employeeId.trim()) {
      setStatus('error');
      setStatusMessage('Please enter your Employee ID.');
      return;
    }

    try {
      // 1. Verify employee exists
      const { data: verifyResult, error: verifyError } = await supabase.rpc('verify_employee_id', {
        emp_id: employeeId.trim()
      });

      if (verifyError || !verifyResult || !verifyResult.success) {
        const errorMsg = verifyError?.message || verifyResult?.error || `Employee ID "${employeeId}" not found or inactive.`;
        throw new Error(errorMsg);
      }

      const workerName = verifyResult.name;

      // 2. Capture photo
      const photoBlob = capturePhoto();
      if (!photoBlob) {
        throw new Error("Failed to capture photo. Make sure camera is working.");
      }

      // 3. Upload photo
      const photoUrl = await uploadPhoto(photoBlob, employeeId.trim().toUpperCase(), action);

      const today = new Date().toLocaleDateString('en-CA'); // Local date in YYYY-MM-DD format
      const now = new Date().toISOString();
      const currentLocation = await getCurrentLocation();

      // 1. Fetch any TRUE active session (clocked in, but not clocked out)
      const { data: activeSession, error: activeError } = await supabase
        .from('selfie_attendance')
        .select('id, check_out, date, punch_status')
        .eq('employee_id', employeeId.trim().toUpperCase())
        .is('check_out', null)
        .not('check_in', 'is', null) // Must have a check_in time to be an active session
        .limit(1)
        .maybeSingle();

      if (activeError) {
        console.error("Database Fetch Error:", activeError);
        throw new Error(`Database Fetch Error: ${activeError.message}`);
      }

      if (action === 'punch_in') {
        console.log("Checking status for Punch In...", { employeeId, today });
        if (activeSession) {
          console.log("Found active session:", activeSession);
          throw new Error(`You are already Punched IN. Please Punch OUT first.`);
        }

        // 1. Check for an APPROVED EXTRA PUNCH record today
        // We look for any record that is 'approved' but has no check_in time yet
        const { data: approvedRequest } = await supabase
          .from('selfie_attendance')
          .select('id, punch_status')
          .eq('employee_id', employeeId.trim().toUpperCase())
          .eq('date', today)
          .eq('punch_status', 'approved')
          .is('check_in', null)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (approvedRequest) {
           console.log("Found approved authorization! Updating record:", approvedRequest.id);
           const { error: updateError } = await supabase
             .from('selfie_attendance')
             .update({
               check_in: now,
               check_in_photo: photoUrl,
               location_in: currentLocation,
               updated_at: now
             })
             .eq('id', approvedRequest.id);

           if (updateError) throw updateError;

           setStatus('success');
           setStatusMessage(`Successfully Punched IN (Authorized) at ${new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}. Welcome back, ${workerName}!`);
           return;
        }

        // 2. Check for a PENDING EXTRA PUNCH record today
        const { data: pendingRequest } = await supabase
          .from('selfie_attendance')
          .select('id, punch_status')
          .eq('employee_id', employeeId.trim().toUpperCase())
          .eq('date', today)
          .eq('punch_status', 'pending')
          .is('check_in', null)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingRequest) {
           console.log("Found pending request, blocking.");
           throw new Error(`Your extra punch request is pending. Please wait for the Director to approve it.`);
        }

        // 3. Check if they ALREADY completed a shift today (to show request modal)
        const { data: completedRecord } = await supabase
          .from('selfie_attendance')
          .select('id')
          .eq('employee_id', employeeId.trim().toUpperCase())
          .eq('date', today)
          .not('check_out', 'is', null)
          .limit(1)
          .maybeSingle();

        if (completedRecord) {
           console.log("Found completed shift today, but no approval. Showing modal.");
           setShowPermissionModal(true);
           setStatus('idle');
           return;
        }
        
        // 4. STANDARD FIRST PUNCH OF THE DAY 
        // We only reach here if no approved/pending/completed records exist for today
        console.log("Proceeding with standard first punch insert.");
        const { error: insertError } = await supabase
          .from('selfie_attendance')
          .insert({
            employee_id: employeeId.trim().toUpperCase(),
            date: today,
            check_in: now,
            check_in_photo: photoUrl,
            work_area: workArea,
            location_in: currentLocation,
            punch_status: 'approved'
          });

        if (insertError) throw insertError;
        setStatus('success');
        setStatusMessage(`Successfully Punched IN at ${new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}. Welcome, ${workerName}!`);
        return;
      } else {
        // PUNCH OUT LOGIC: must have an active session
        if (!activeSession) {
          throw new Error(`No active Punch In found. Please Punch In first.`);
        }

        console.log("Preparing to update record:", activeSession);

        // Try primary update by ID
        let { data: updateData, error: updateError } = await supabase
          .from('selfie_attendance')
          .update({
             check_out: now,
             check_out_photo: photoUrl,
             location_out: currentLocation,
             updated_at: now
          })
          .eq('id', activeSession.id)
          .select();

        // Fallback: If primary update returned no rows, try by matching current open session for this employee
        if (!updateError && (!updateData || updateData.length === 0)) {
          console.warn("Primary ID update returned no rows. Attempting fallback match...");
          const fallbackResponse = await supabase
            .from('selfie_attendance')
            .update({
                check_out: now,
                check_out_photo: photoUrl,
                location_out: currentLocation,
                updated_at: now
             })
            .match({ employee_id: employeeId.trim().toUpperCase() })
            .is('check_out', null)
            .select();
          
          updateData = fallbackResponse.data;
          updateError = fallbackResponse.error;
        }

        if (updateError) {
          console.error("Punch Out Error:", updateError);
          throw new Error(`Punch Out Error: ${updateError.message}`);
        }

        if (!updateData || updateData.length === 0) {
          throw new Error("Failed to record Punch Out. Please contact support.");
        }

        setStatus('success');
        setStatusMessage(`Successfully Punched OUT at ${new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}. Goodbye, ${workerName}!`);
      }

      // Reset form after short delay
      setTimeout(() => {
        setEmployeeId('');
        setStatus('idle');
        setCapturedPhoto(null);
        startCamera(); // Restart live feed
      }, 5000);

    } catch (err: unknown) {
      console.error('Attendance Process Error:', err);
      setStatus('error');
      setStatusMessage(formatErrorMessage(err) || 'An unexpected error occurred.');
    }
  };

  const handleRequestPermission = async () => {
    if (!requestReason.trim()) {
      alert("Please enter a reason for the extra punch.");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Create a pending attendance record
      // NOTE: We do NOT set check_in yet. The user will punch in after approval.
      const { data: newRecord, error: insertError } = await supabase
        .from('selfie_attendance')
        .insert({
          employee_id: employeeId.trim().toUpperCase(),
          date: today,
          punch_status: 'pending',
          request_reason: requestReason.trim(),
          check_in: null, // Critical: Only authorized to check in later
          check_in_photo: capturedPhoto, 
          work_area: workArea
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!newRecord) throw new Error("Failed to create attendance record.");

      // 2. Find a Director to notify
      const { data: director } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'director')
        .limit(1)
        .maybeSingle();

      // 3. Create approval workflow request
      const { error: approvalError } = await supabase
        .from('approval_workflows')
        .insert({
          record_type: 'extra_punch',
          record_id: newRecord.id,
          submitted_by: (await supabase.auth.getUser()).data.user?.id || director?.id || null, 
          status: 'pending'
        });

      if (approvalError) {
        console.error("Workflow Error:", approvalError);
      }

      // 3. Create notification for Director
      if (director) {
        await supabase.from('notifications').insert({
          user_id: director.id,
          title: 'Extra Punch Permission Requested',
          message: `Employee ${employeeId.trim().toUpperCase()} is requesting an extra punch for today: "${requestReason}"`,
          type: 'approval'
        });
      }

      setShowPermissionModal(false);
      setStatus('success');
      setStatusMessage("Your request for an extra punch has been submitted to the Director. Please wait for approval.");
      setRequestReason('');
      
    } catch (err: any) {
      console.error("Error requesting permission:", err);
      const errorMsg = err.message || err.details || (typeof err === 'string' ? err : "Connect error");
      alert("Failed to submit request: " + errorMsg);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 bg-slate-50">
       <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {workArea === 'quarry' ? 'Quarry' : workArea === 'crusher' ? 'Crusher' : ''} Attendance Terminal
            </h1>
            {workArea !== 'general' && (
              <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${
                workArea === 'quarry' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {workArea === 'quarry' ? '⛏ Quarry Work' : '🏭 Crusher Work'}
              </span>
            )}
            <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">Position your face in the camera and enter your Employee ID</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            {/* Camera View */}
            <div className="bg-black rounded-2xl overflow-hidden shadow-lg relative aspect-square md:aspect-video flex items-center justify-center">
                {hasCameraAccess === false ? (
                     <div className="text-white text-center p-6 text-sm">
                        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                        <p>Camera access denied or device not found.</p>
                        <p className="mt-2 text-slate-400">Please allow camera permissions and refresh.</p>
                     </div>
                ) : (
                    <>
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted
                            className={`w-full h-full object-cover transform scale-x-[-1] ${capturedPhoto ? 'hidden' : 'block'}`}
                        />
                         {capturedPhoto && (
                            <img 
                                src={capturedPhoto} 
                                alt="Captured selfie" 
                                className="w-full h-full object-cover transform scale-x-[-1]"
                            />
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                        
                        {!capturedPhoto && status === 'idle' && (
                            <div className="absolute inset-x-0 bottom-4 text-center pointer-events-none">
                                <span className="text-[10px] sm:text-xs bg-black/50 text-white px-3 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    Live Feed
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 flex flex-col justify-center">
                
                {status === 'success' ? (
                     <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300 py-4">
                         <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
                         </div>
                         <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Success!</h3>
                         <p className="text-base sm:text-lg text-slate-600">{statusMessage}</p>
                         <p className="text-[10px] sm:text-xs text-slate-400 mt-4">Resetting in a few seconds...</p>
                     </div>
                ) : (
                    <div className="space-y-5 sm:space-y-6">
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">Employee ID</label>
                            <input 
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                placeholder="e.g. EMP001"
                                className="w-full text-center text-2xl sm:text-3xl tracking-widest font-mono uppercase px-3 py-3 sm:px-4 sm:py-4 border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                disabled={status === 'loading'}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') handleAttendance('punch_in');
                                }}
                            />
                        </div>

                        {status === 'error' && (
                            <div className="p-3 sm:p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs sm:text-sm flex gap-3 animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>{statusMessage}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                            <button
                                onClick={() => handleAttendance('punch_in')}
                                disabled={status === 'loading' || !hasCameraAccess}
                                className="flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                {status === 'loading' ? (
                                    <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mb-2 sm:mb-3" />
                                ) : (
                                    <LogIn className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3" />
                                )}
                                <span className="font-semibold text-sm sm:text-lg">PUNCH IN</span>
                            </button>
                            
                            <button
                                onClick={() => handleAttendance('punch_out')}
                                disabled={status === 'loading' || !hasCameraAccess}
                                className="flex flex-col items-center justify-center p-4 sm:p-6 bg-white outline outline-2 outline-slate-200 text-slate-800 rounded-2xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95 shadow-sm"
                            >
                                <LogOut className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3 text-slate-600" />
                                <span className="font-semibold text-sm sm:text-lg">PUNCH OUT</span>
                            </button>
                        </div>
                    </div>
                )}
      </div>
      
      {showPermissionModal && (
        <PermissionModal 
          reason={requestReason}
          setReason={setRequestReason}
          onSubmit={handleRequestPermission}
          onClose={() => setShowPermissionModal(false)}
          loading={isSubmittingRequest}
        />
      )}
    </div>
  </div>
  );
}

function PermissionModal({ 
  reason, 
  setReason, 
  onSubmit, 
  onClose, 
  loading 
}: { 
  reason: string, 
  setReason: (s: string) => void, 
  onSubmit: () => void, 
  onClose: () => void,
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header - Light Blue Theme */}
        <div className="bg-blue-50 p-6 border-b border-blue-100 flex flex-col items-center text-center">
           <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-3">
             <span className="text-2xl">🛡️</span>
           </div>
           <h3 className="text-xl font-bold text-slate-900">Permission Required</h3>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
           <p className="text-center text-slate-600 leading-relaxed text-sm">
             You have already completed your attendance today. To punch in again, you need permission from the <span className="font-semibold text-blue-600">Director</span>.
           </p>

           <div className="space-y-3">
             <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reason for Extra Punch</label>
             <textarea 
               value={reason}
               onChange={(e) => setReason(e.target.value)}
               placeholder="Why do you need to work more today?"
               className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-28"
               disabled={loading}
             />
           </div>

           <button 
             onClick={onSubmit}
             disabled={loading || !reason.trim()}
             className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all transform active:scale-95"
           >
             {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : null}
             {loading ? 'Submitting...' : 'Request Permission'}
           </button>

           <button 
             onClick={onClose}
             disabled={loading}
             className="w-full py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
           >
             Not Now, Go Back
           </button>
        </div>
      </div>
    </div>
  );
}
