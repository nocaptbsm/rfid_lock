import React from 'react';
import { cn } from '@/utils/cn';
import StatusBadge from '@/components/cards/StatusBadge';

const LiveStudentsTable = ({ students }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-secondary/50">
          <tr className="text-muted-foreground border-b border-border">
            <th className="px-6 py-4 font-semibold uppercase tracking-wider">Student</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider">Roll Number</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider">Entry Time</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider">Duration</th>
            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {students.map((student, idx) => {
            const isLong = student.status === 'Long Session';
            return (
              <tr 
                key={student.roll} 
                className={cn(
                  "hover:bg-secondary/30 transition-colors group",
                  isLong ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                )}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {student.name.charAt(0)}
                    </div>
                    <span className="font-medium">{student.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-muted-foreground">{student.roll}</td>
                <td className="px-6 py-4">{student.entryTime}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "font-medium",
                    isLong ? "text-amber-600 dark:text-amber-400" : ""
                  )}>
                    {student.duration}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <StatusBadge status={student.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LiveStudentsTable;
