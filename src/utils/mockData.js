export const MOCK_STUDENT_DATA = {
  roll: '21CS042',
  name: 'Abhishek Ranjan',
  status: 'Inside',
  today: {
    entryTime: '09:45 AM',
    exitTime: '--',
    totalDuration: '3h 22m',
    isLongSession: false
  },
  weekly: [
    { day: 'Mon', hours: 4.5 },
    { day: 'Tue', hours: 3.2 },
    { day: 'Wed', hours: 5.8 },
    { day: 'Thu', hours: 4.0 },
    { day: 'Fri', hours: 3.5 },
    { day: 'Sat', hours: 2.1 },
    { day: 'Sun', hours: 0 }
  ],
  monthly: Array.from({ length: 30 }, (_, i) => ({
    date: i + 1,
    hours: Math.random() * 6
  }))
};

// Raw RFID log with alphanumeric UIDs — simulates what the hardware sends
export const MOCK_RFID_LOGS = [
  { id: 1,  rfid: 'A3F2C9D1', type: 'ENTRY', timestamp: '2025-04-21 09:45:12' },
  { id: 2,  rfid: 'B7E1A0F4', type: 'ENTRY', timestamp: '2025-04-21 09:52:04' },
  { id: 3,  rfid: 'CC014D88', type: 'ENTRY', timestamp: '2025-04-21 10:03:37' },
  { id: 4,  rfid: 'A3F2C9D1', type: 'EXIT',  timestamp: '2025-04-21 10:15:00' },
  { id: 5,  rfid: 'D9B3E7F2', type: 'ENTRY', timestamp: '2025-04-21 10:22:45' },
  { id: 6,  rfid: 'B7E1A0F4', type: 'EXIT',  timestamp: '2025-04-21 11:05:18' },
  { id: 7,  rfid: 'E2A5C6B8', type: 'ENTRY', timestamp: '2025-04-21 11:10:33' },
  { id: 8,  rfid: 'CC014D88', type: 'EXIT',  timestamp: '2025-04-21 11:44:09' },
  { id: 9,  rfid: 'F1D8A3C7', type: 'ENTRY', timestamp: '2025-04-21 11:50:22' },
  { id: 10, rfid: 'D9B3E7F2', type: 'EXIT',  timestamp: '2025-04-21 12:30:01' },
  { id: 11, rfid: '0A4F8B2E', type: 'ENTRY', timestamp: '2025-04-21 12:35:48' },
  { id: 12, rfid: 'E2A5C6B8', type: 'EXIT',  timestamp: '2025-04-21 13:10:55' },
  { id: 13, rfid: 'A3F2C9D1', type: 'ENTRY', timestamp: '2025-04-21 13:20:10' },
  { id: 14, rfid: 'F1D8A3C7', type: 'EXIT',  timestamp: '2025-04-21 13:45:37' },
  { id: 15, rfid: '7C3D9E0A', type: 'ENTRY', timestamp: '2025-04-21 14:00:12' },
  { id: 16, rfid: '0A4F8B2E', type: 'EXIT',  timestamp: '2025-04-21 14:22:30' },
  { id: 17, rfid: 'B7E1A0F4', type: 'ENTRY', timestamp: '2025-04-21 14:30:05' },
  { id: 18, rfid: '7C3D9E0A', type: 'EXIT',  timestamp: '2025-04-21 15:00:44' },
  { id: 19, rfid: 'CC014D88', type: 'ENTRY', timestamp: '2025-04-21 15:05:17' },
  { id: 20, rfid: 'A3F2C9D1', type: 'EXIT',  timestamp: '2025-04-21 15:30:22' },
];

export const MOCK_ADMIN_DATA = {
  totalInside: 42,
  avgDuration: '2h 15m',
  peakHour: '11:00 AM',
  liveStudents: [
    { rfid: 'A3F2C9D1', entryTime: '09:45 AM', duration: '3h 22m', status: 'Inside' },
    { rfid: 'B7E1A0F4', entryTime: '08:30 AM', duration: '4h 37m', status: 'Long Session' },
    { rfid: 'CC014D88', entryTime: '10:15 AM', duration: '2h 52m', status: 'Inside' },
    { rfid: 'D9B3E7F2', entryTime: '11:20 AM', duration: '1h 47m', status: 'Inside' },
  ],
  scanFeed: [
    { id: 1, rfid: 'D9B3E7F2', type: 'ENTRY', time: '11:20 AM' },
    { id: 2, rfid: 'E2A5C6B8', type: 'EXIT',  time: '11:15 AM' },
    { id: 3, rfid: 'CC014D88', type: 'ENTRY', time: '10:15 AM' },
    { id: 4, rfid: 'A3F2C9D1', type: 'ENTRY', time: '09:45 AM' },
  ],
  topStudents: [
    { rank: 1, rfid: 'B7E1A0F4', totalHours: '124h', trend: 5 },
    { rank: 2, rfid: 'A3F2C9D1', totalHours: '118h', trend: -2 },
    { rank: 3, rfid: 'E2A5C6B8', totalHours: '112h', trend: 10 },
  ]
};
