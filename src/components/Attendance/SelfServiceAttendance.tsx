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

  const capturePhoto = useCallback((): Blob | null => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
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
    }
    return null;
  }, []);

  const uploadPhoto = async (blob: Blob, empId: string, action: ActionType): Promise<string> => {
    const timestamp = new Date().getTime();
    const fileName = `${empId}_${action}_${timestamp}.jpg`;
    
    const { error } = await supabase.storage
      .from('attendance-photos')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("Storage Error Detail:", error);
      throw new Error(`Storage Upload Error: ${error.message}`);
    }
    
    // Get public URL
    const { data: publicData } = supabase.storage
      .from('attendance-photos')
      .getPublicUrl(fileName);
      
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

      // 4. Record attendance
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Check current status: Fetch the most recent Open record for this employee
      // We look for any record where check_out is NULL, ordered by check_in desc
      const { data: activeRecord, error: activeError } = await supabase
        .from('selfie_attendance')
        .select('id, check_out, date')
        .eq('employee_id', employeeId.trim().toUpperCase())
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeError) {
        console.error("Database Fetch Error:", activeError);
        throw new Error(`Database Fetch Error: ${activeError.message}`);
      }

      // If we are punching in, we must not have an active session
      // If we are punching out, we MUST have an active session
      if (action === 'punch_in') {
        if (activeRecord) {
          throw new Error(`You are already Punched IN. Please Punch OUT first.`);
        }

        const { error: insertError } = await supabase
          .from('selfie_attendance')
          .insert({
            employee_id: employeeId.trim().toUpperCase(),
            date: today,
            check_in: now,
            check_in_photo: photoUrl,
            work_area: workArea
          });

        if (insertError) {
          console.error("Database Insert Error:", insertError);
          throw new Error(`Database Insert Error: ${insertError.message}`);
        }

        setStatus('success');
        setStatusMessage(`Successfully Punched IN at ${new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}. Welcome, ${workerName}!`);

      } else {
        // Punch out logic: must have an active session
        if (!activeRecord) {
          throw new Error(`No active Punch In found. Please Punch In first.`);
        }

        console.log("Preparing to update record:", activeRecord);

        // Try primary update by ID
        let { data: updateData, error: updateError } = await supabase
          .from('selfie_attendance')
          .update({
             check_out: now,
             check_out_photo: photoUrl,
             updated_at: now
          })
          .eq('id', activeRecord.id)
          .select();

        // Fallback: If primary update returned no rows, try by matching current open session for this employee
        if (!updateError && (!updateData || updateData.length === 0)) {
          console.warn("Primary ID update returned no rows. Attempting fallback match...");
          const fallbackResponse = await supabase
            .from('selfie_attendance')
            .update({
               check_out: now,
               check_out_photo: photoUrl,
               updated_at: now
            })
            .match({ employee_id: employeeId.trim().toUpperCase() })
            .is('check_out', null)
            .select();
          
          updateData = fallbackResponse.data;
          updateError = fallbackResponse.error;
        }

        if (updateError) {
          console.error("Database Update Error:", updateError);
          throw new Error(`Database Error: ${updateError.message}`);
        }

        if (!updateData || updateData.length === 0) {
          console.error("Critical: Punch Out failed to save even after fallback.", {
            emp_id: employeeId.trim().toUpperCase(),
            target_id: activeRecord.id
          });
          throw new Error("Failed to save Punch Out data. If the error persists, please check your internet connection.");
        }

        console.log("Verified Save Success:", updateData[0]);
        
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
      console.error("Attendance Process Error:", err);
      setStatus('error');
      
      let message = "An unexpected error occurred.";
      
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Try to extract any possible message or stringify the whole object
        const e = err as any;
        message = e.message || e.error_description || e.error || e.msg || JSON.stringify(err);
      } else if (typeof err === 'string') {
        message = err;
      } else {
        message = String(err);
      }
      
      setStatusMessage(message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 lg:p-6 bg-slate-50 min-h-screen">
       <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              {workArea === 'quarry' ? 'Quarry' : workArea === 'crusher' ? 'Crusher' : ''} Attendance Terminal
            </h2>
            {workArea !== 'general' && (
              <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${
                workArea === 'quarry' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {workArea === 'quarry' ? '⛏ Quarry Work' : '🏭 Crusher Work'}
              </span>
            )}
            <p className="text-slate-600 mt-2">Position your face in the camera and enter your Employee ID</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Camera View */}
            <div className="bg-black rounded-2xl overflow-hidden shadow-lg relative aspect-video md:aspect-square flex items-center justify-center">
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
                                <span className="text-xs bg-black/50 text-white px-3 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    Live Feed
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col justify-center">
                
                {status === 'success' ? (
                     <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
                         <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                         </div>
                         <h3 className="text-2xl font-bold text-slate-900">Success!</h3>
                         <p className="text-lg text-slate-600">{statusMessage}</p>
                         <p className="text-sm text-slate-400 mt-4">Resetting in a few seconds...</p>
                     </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Employee ID</label>
                            <input 
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                placeholder="e.g. EMP001"
                                className="w-full text-center text-3xl tracking-widest font-mono uppercase px-4 py-4 border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                                disabled={status === 'loading'}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') handleAttendance('punch_in');
                                }}
                            />
                        </div>

                        {status === 'error' && (
                            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex gap-3 animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p>{statusMessage}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <button
                                onClick={() => handleAttendance('punch_in')}
                                disabled={status === 'loading' || !hasCameraAccess}
                                className="flex flex-col items-center justify-center p-6 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95"
                            >
                                {status === 'loading' ? (
                                    <RefreshCw className="w-8 h-8 animate-spin mb-3" />
                                ) : (
                                    <LogIn className="w-8 h-8 mb-3" />
                                )}
                                <span className="font-semibold text-lg">PUNCH IN</span>
                            </button>
                            
                            <button
                                onClick={() => handleAttendance('punch_out')}
                                disabled={status === 'loading' || !hasCameraAccess}
                                className="flex flex-col items-center justify-center p-6 bg-white outline outline-2 outline-slate-200 text-slate-800 rounded-2xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-95 shadow-sm"
                            >
                                <LogOut className="w-8 h-8 mb-3 text-slate-600" />
                                <span className="font-semibold text-lg">PUNCH OUT</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
