document.addEventListener('DOMContentLoaded', () => {
    // ===== Chart.js Global Defaults =====
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(30, 41, 59, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(99, 102, 241, 0.3)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.padding = 12;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // ===== Load real session history or use demo data =====
    const sessionHistory = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');

    // Demo data (used when no real sessions exist)
    const focusData = [2.5, 1.8, 3.2, 2.0, 1.5, 3.5, 2.8];
    const stressData = [7, 5, 3, 6, 8, 2, 4];
    const motivationData = [4, 6, 8, 5, 3, 9, 7];
    const distractionData = [5, 3, 2, 6, 8, 1, 3];

    // If real session data exists, overlay it onto today
    if (sessionHistory.length > 0) {
        const todayIndex = new Date().getDay();
        const adjustedIdx = todayIndex === 0 ? 6 : todayIndex - 1; // Monday=0
        let todayMinutes = 0;
        const today = new Date().toDateString();
        sessionHistory.forEach(s => {
            if (new Date(s.date).toDateString() === today) {
                todayMinutes += s.duration;
            }
        });
        if (todayMinutes > 0) {
            focusData[adjustedIdx] = Math.round(todayMinutes / 60 * 10) / 10;
        }
    }

    // Update stat cards
    const totalHours = focusData.reduce((a, b) => a + b, 0).toFixed(1);
    document.getElementById('totalFocusHours').textContent = totalHours;

    const focusStats = JSON.parse(localStorage.getItem('ifocus_focus_stats') || '{}');
    document.getElementById('tasksCompleted').textContent = focusStats.sessions ? focusStats.sessions + 20 : 23;
    document.getElementById('streakDays').textContent = focusStats.streak || 5;

    const avgDist = (distractionData.reduce((a, b) => a + b, 0) / 7).toFixed(1);
    document.getElementById('avgDistractions').textContent = avgDist;

    // ===== Chart 1: Focus Hours (Bar) =====
    const focusCtx = document.getElementById('focusChart').getContext('2d');
    new Chart(focusCtx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Focus Hours',
                data: focusData,
                backgroundColor: (ctx) => {
                    const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
                    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.2)');
                    return gradient;
                },
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y} hours focused`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { callback: (v) => v + 'h' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // ===== Chart 2: Emotional Trendline (Line) =====
    const emotionalCtx = document.getElementById('emotionalChart').getContext('2d');
    new Chart(emotionalCtx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Stress Level',
                    data: stressData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#ef4444',
                },
                {
                    label: 'Motivation',
                    data: motivationData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#10b981',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                    }
                },
                tooltip: {
                    callbacks: {
                        afterBody: (items) => {
                            const idx = items[0].dataIndex;
                            const stress = stressData[idx];
                            const focus = focusData[idx];
                            if (stress >= 7) {
                                return `⚠️ High stress correlated with ${focus}h focus`;
                            } else if (stress <= 3) {
                                return `✅ Low stress — excellent focus day!`;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { stepSize: 2 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // ===== Chart 3: Distraction Heatmap (Bar chart styled as heatmap) =====
    const distractionCtx = document.getElementById('distractionChart').getContext('2d');
    new Chart(distractionCtx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Distractions',
                data: distractionData,
                backgroundColor: distractionData.map(v => {
                    if (v >= 7) return 'rgba(239, 68, 68, 0.8)';
                    if (v >= 4) return 'rgba(245, 158, 11, 0.7)';
                    return 'rgba(16, 185, 129, 0.6)';
                }),
                borderColor: distractionData.map(v => {
                    if (v >= 7) return '#ef4444';
                    if (v >= 4) return '#f59e0b';
                    return '#10b981';
                }),
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const v = ctx.parsed.y;
                            const focus = focusData[ctx.dataIndex];
                            let severity = v >= 7 ? '🔴 High' : v >= 4 ? '🟡 Medium' : '🟢 Low';
                            return [`${severity} — ${v} distractions`, `Focus: ${focus} hours that day`];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    title: { display: true, text: 'Distraction Count' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // ===== Chart 4: Session Type Distribution (Doughnut) =====
    const sessionCtx = document.getElementById('sessionTypeChart').getContext('2d');
    new Chart(sessionCtx, {
        type: 'doughnut',
        data: {
            labels: ['25 min Focus', '50 min Deep Work', '15 min Quick', '90 min Flow'],
            datasets: [{
                data: [8, 4, 6, 2],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(236, 72, 153, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                ],
                borderColor: 'rgba(15, 23, 42, 0.8)',
                borderWidth: 3,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed} sessions`
                    }
                }
            }
        }
    });
});
