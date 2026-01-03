import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, Save, Plus } from 'lucide-react';

const workTypes = [
	'Drilling',
	'Blasting',
	'Breaking/Loading',
	'Transport',
	'Maintenance',
	'Site Preparation',
	'Other',
];

const locationTypes = [
	'Quarry',
	'Crusher',
	'Production'
];

interface Worker {
	id: string;
	name: string;
	employee_id: string;
}

export function AttendanceForm({ onSuccess }: { onSuccess?: () => void }) {
	const { user } = useAuth();
	const [loading, setLoading] = useState(false);
	const [workers, setWorkers] = useState<Worker[]>([]);
	const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
	const [showAddWorker, setShowAddWorker] = useState(false);
	const [newWorkerName, setNewWorkerName] = useState('');
	const [newWorkerEmployeeId, setNewWorkerEmployeeId] = useState('');
	const [formData, setFormData] = useState({
		date: new Date().toISOString().split('T')[0],
		check_in: new Date().toTimeString().slice(0, 5),
		check_out: '',
		location: '',
		work_type: '',
		notes: '',
	});

	useEffect(() => {
		loadWorkers();
	}, []);

	const loadWorkers = async () => {
		try {
			const { data, error } = await supabase
				.from('workers')
				.select('*')
				.eq('is_active', true)
				.order('name', { ascending: true });

			if (error) throw error;
			setWorkers(data || []);
		} catch (error) {
			console.error('Error loading workers:', error);
		}
	};

	const handleAddWorker = useCallback(async () => {
		if (!newWorkerName.trim()) return;

		try {
			const { data, error } = await supabase
				.from('workers')
				.insert([
					{
						name: newWorkerName.trim(),
						employee_id: newWorkerEmployeeId.trim() || null,
						is_active: true,
					},
				])
				.select()
				.single();

			if (error) throw error;

			setWorkers([...workers, data]);
			setSelectedWorkers([...selectedWorkers, data.id]);
			setNewWorkerName('');
			setNewWorkerEmployeeId('');
			setShowAddWorker(false);
			alert('Worker added successfully!');
		} catch (error) {
			alert('Error adding worker: ' + (error instanceof Error ? error.message : 'Unknown error'));
		}
	}, [newWorkerName, newWorkerEmployeeId, workers, selectedWorkers]);

	const toggleWorkerSelection = useCallback(
		(workerId: string) => {
			if (selectedWorkers.includes(workerId)) {
				setSelectedWorkers(selectedWorkers.filter((id) => id !== workerId));
			} else {
				setSelectedWorkers([...selectedWorkers, workerId]);
			}
		},
		[selectedWorkers]
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		// Add time validation
		if (formData.check_out) {
			const checkIn = new Date(`${formData.date}T${formData.check_in}`);
			const checkOut = new Date(`${formData.date}T${formData.check_out}`);
			if (checkOut <= checkIn) {
				alert('Check-out time must be after check-in time');
				return;
			}
		}

		if (selectedWorkers.length === 0) {
			alert('Please select at least one worker');
			return;
		}

		setLoading(true);
		try {
			const checkInDateTime = new Date(
				`${formData.date}T${formData.check_in}:00`
			).toISOString();
			const checkOutDateTime = formData.check_out
				? new Date(`${formData.date}T${formData.check_out}:00`).toISOString()
				: null;

			const selectedWorkerData = workers.filter((w) =>
				selectedWorkers.includes(w.id)
			);
			const workerNames = selectedWorkerData.map((w) => w.name);

			const { error } = await supabase
				.from('attendance_records')
				.insert([
					{
						user_id: user.id,
						date: formData.date,
						check_in: checkInDateTime,
						check_out: checkOutDateTime,
						location: formData.location,
						work_type: formData.work_type,
						notes: formData.notes,
						status: 'present',
						worker_ids: selectedWorkers,
						number_of_workers: selectedWorkers.length,
						worker_names: workerNames,
					},
				]);

			if (error) throw error;

			setFormData({
				date: new Date().toISOString().split('T')[0],
				check_in: new Date().toTimeString().slice(0, 5),
				check_out: '',
				location: '',
				work_type: '',
				notes: '',
			});
			setSelectedWorkers([]);

			alert('Attendance record submitted successfully!');
			if (onSuccess) onSuccess();
		} catch (error) {
			alert('Error submitting attendance record: ' + (error instanceof Error ? error.message : 'Unknown error'));
		} finally {
			setLoading(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
		>
			<div className="flex items-center gap-3 mb-6">
				<div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
					<Clock className="w-5 h-5 text-blue-600" />
				</div>
				<div>
					<h3 className="text-lg font-semibold text-slate-900">
						New Attendance Record
					</h3>
					<p className="text-sm text-slate-600">
						Record daily attendance and work hours
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Date
					</label>
					<input
						type="date"
						value={formData.date}
						onChange={(e) =>
							setFormData({ ...formData, date: e.target.value })
						}
						required
						className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Location *
					</label>
					<select
						value={formData.location}
						onChange={(e) =>
							setFormData({ ...formData, location: e.target.value })
						}
						required
						className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="">Select location</option>
						{locationTypes.map((location) => (
							<option key={location} value={location}>
								{location}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Check In Time
					</label>
					<input
						type="time"
						value={formData.check_in}
						onChange={(e) =>
							setFormData({ ...formData, check_in: e.target.value })
						}
						required
						className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Check Out Time
					</label>
					<input
						type="time"
						value={formData.check_out}
						onChange={(e) =>
							setFormData({ ...formData, check_out: e.target.value })
						}
						className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>

				<div className="md:col-span-2">
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Work Type
					</label>
					<select
						value={formData.work_type}
						onChange={(e) =>
							setFormData({ ...formData, work_type: e.target.value })
						}
						required
						className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
						<option value="">Select work type</option>
						{workTypes.map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</select>
				</div>

				<div className="md:col-span-2">
					<div className="flex items-center justify-between mb-2">
						<label className="block text-sm font-medium text-slate-700">
							Workers ({selectedWorkers.length} selected)
						</label>
						<button
							type="button"
							onClick={() => setShowAddWorker(!showAddWorker)}
							className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
						>
							<Plus className="w-4 h-4" />
							Add New Worker
						</button>
					</div>

					{showAddWorker && (
						<div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-medium text-slate-700 mb-1">
										Worker Name *
									</label>
									<input
										type="text"
										value={newWorkerName}
										onChange={(e) => setNewWorkerName(e.target.value)}
										className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										placeholder="Enter worker name"
									/>
								</div>
								<div>
									<label className="block text-xs font-medium text-slate-700 mb-1">
										Employee ID (optional)
									</label>
									<input
										type="text"
										value={newWorkerEmployeeId}
										onChange={(e) => setNewWorkerEmployeeId(e.target.value)}
										className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										placeholder="e.g., EMP-001"
									/>
								</div>
							</div>
							<div className="flex gap-2 mt-3">
								<button
									type="button"
									onClick={handleAddWorker}
									disabled={!newWorkerName.trim()}
									className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<Plus className="w-4 h-4" />
									Add Worker
								</button>
								<button
									type="button"
									onClick={() => {
										setShowAddWorker(false);
										setNewWorkerName('');
										setNewWorkerEmployeeId('');
									}}
									className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					<div className="border border-slate-300 rounded-lg p-4 max-h-64 overflow-y-auto">
						{workers.length === 0 ? (
							<p className="text-sm text-slate-600 text-center py-4">
								No workers found. Add your first worker above.
							</p>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
								{workers.map((worker) => (
									<label
										key={worker.id}
										className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${selectedWorkers.includes(worker.id)
												? 'border-blue-500 bg-blue-50'
												: 'border-slate-200 hover:border-slate-300'
											}`}
									>
										<input
											type="checkbox"
											checked={selectedWorkers.includes(worker.id)}
											onChange={() => toggleWorkerSelection(worker.id)}
											className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
										/>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-slate-900 truncate">
												{worker.name}
											</p>
											{worker.employee_id && (
												<p className="text-xs text-slate-600 truncate">
													{worker.employee_id}
												</p>
											)}
										</div>
									</label>
								))}
							</div>
						)}
					</div>
				</div>

				<div className="md:col-span-2">
					<label className="block text-sm font-medium text-slate-700 mb-2">
						Notes
					</label>
					<textarea
						value={formData.notes}
						onChange={(e) =>
							setFormData({ ...formData, notes: e.target.value })
						}
						rows={3}
						className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						placeholder="Work activities, overtime, special tasks..."
					/>
				</div>
			</div>

			<div className="mt-6 flex justify-end">
				<button
					type="submit"
					disabled={loading || selectedWorkers.length === 0}
					className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Save className="w-4 h-4" />
					{loading ? 'Saving...' : 'Save Record'}
				</button>
			</div>
		</form>
	);
}
