import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '@/context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const MonthlyLineChart = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        fill: true,
        label: 'Study Hours',
        data: data.map(d => d.hours),
        borderColor: '#8b5cf6',
        backgroundColor: (context) => {
          const bg = context.chart.ctx.createLinearGradient(0, 0, 0, 400);
          bg.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
          bg.addColorStop(1, 'rgba(139, 92, 246, 0)');
          return bg;
        },
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        borderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#fff',
        titleColor: isDark ? '#f8fafc' : '#1e293b',
        bodyColor: isDark ? '#94a3b8' : '#64748b',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' },
      },
      x: {
        grid: { display: false },
        ticks: { 
          color: isDark ? '#94a3b8' : '#64748b',
          maxTicksLimit: 10
        },
      },
    },
  };

  return (
    <div className="h-48 sm:h-64 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default MonthlyLineChart;
