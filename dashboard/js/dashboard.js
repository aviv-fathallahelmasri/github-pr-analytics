// Dashboard JavaScript
let metricsData = {};
let prData = [];

// Load data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadMetrics();
    loadPRData();
});

// Load metrics from JSON file
async function loadMetrics() {
    try {
        const response = await fetch('data/metrics.json');
        metricsData = await response.json();
        updateMetricsDisplay();
        updateLastUpdate();
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

// Load PR data from CSV
async function loadPRData() {
    try {
        const response = await fetch('data/pr_data.csv');
        const csvText = await response.text();
        prData = parseCSV(csvText);
        
        createCharts();
        populatePRTable();
    } catch (error) {
        console.error('Error loading PR data:', error);
    }
}

// Parse CSV text to array of objects
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const values = lines[i].split(',');
        const row = {};
        
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        
        data.push(row);
    }
    
    return data;
}

// Update metrics display
function updateMetricsDisplay() {
    document.getElementById('totalPRs').textContent = metricsData.total_prs || '0';
    document.getElementById('mergeRate').textContent = (metricsData.merge_rate || 0) + '%';
    document.getElementById('avgMergeTime').textContent = 
        (metricsData.avg_merge_time_hours || 0).toFixed(1) + 'h';
    document.getElementById('activeAuthors').textContent = metricsData.active_authors || '0';
    document.getElementById('reviewCoverage').textContent = 
        (metricsData.review_coverage || 0) + '%';
    document.getElementById('fastMergeRate').textContent = 
        (metricsData.fast_merge_rate || 0).toFixed(1) + '%';
}

// Update last update time
function updateLastUpdate() {
    const lastUpdate = metricsData.last_updated;
    if (lastUpdate) {
        const date = new Date(lastUpdate);
        const formatted = date.toLocaleString();
        document.getElementById('lastUpdate').textContent = 'Last updated: ' + formatted;
    }
}

// Create all charts
function createCharts() {
    createStatusChart();
    createAuthorsChart();
    createTrendsChart();
    createMergeTimeChart();
}

// Create status distribution pie chart
function createStatusChart() {
    const statusCounts = {
        open: 0,
        closed: 0,
        merged: 0
    };
    
    prData.forEach(pr => {
        if (pr.is_merged === 'True') {
            statusCounts.merged++;
        } else if (pr.state === 'open') {
            statusCounts.open++;
        } else {
            statusCounts.closed++;
        }
    });
    
    const ctx = document.getElementById('statusChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Open', 'Merged', 'Closed'],
            datasets: [{
                data: [statusCounts.open, statusCounts.merged, statusCounts.closed],
                backgroundColor: ['#28a745', '#6f42c1', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Create top authors bar chart
function createAuthorsChart() {
    const authorCounts = {};
    
    prData.forEach(pr => {
        const author = pr.author;
        authorCounts[author] = (authorCounts[author] || 0) + 1;
    });
    
    // Get top 10 authors
    const sortedAuthors = Object.entries(authorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const ctx = document.getElementById('authorsChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedAuthors.map(a => a[0]),
            datasets: [{
                label: 'Pull Requests',
                data: sortedAuthors.map(a => a[1]),
                backgroundColor: '#667eea'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Create monthly trends line chart
function createTrendsChart() {
    const monthlyData = {};
    
    prData.forEach(pr => {
        if (pr.created_at) {
            const date = new Date(pr.created_at);
            const monthKey = date.getFullYear() + '-' + 
                String(date.getMonth() + 1).padStart(2, '0');
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        }
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const lastSixMonths = sortedMonths.slice(-6);
    
    const ctx = document.getElementById('trendsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: lastSixMonths,
            datasets: [{
                label: 'PRs Created',
                data: lastSixMonths.map(m => monthlyData[m]),
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Create merge time distribution histogram
function createMergeTimeChart() {
    const mergeTimeBuckets = {
        '<1h': 0,
        '1-6h': 0,
        '6-24h': 0,
        '1-3d': 0,
        '3-7d': 0,
        '>7d': 0
    };
    
    prData.forEach(pr => {
        if (pr.merge_time_hours && pr.merge_time_hours !== '') {
            const hours = parseFloat(pr.merge_time_hours);
            if (hours < 1) mergeTimeBuckets['<1h']++;
            else if (hours <= 6) mergeTimeBuckets['1-6h']++;
            else if (hours <= 24) mergeTimeBuckets['6-24h']++;
            else if (hours <= 72) mergeTimeBuckets['1-3d']++;
            else if (hours <= 168) mergeTimeBuckets['3-7d']++;
            else mergeTimeBuckets['>7d']++;
        }
    });
    
    const ctx = document.getElementById('mergeTimeChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(mergeTimeBuckets),
            datasets: [{
                label: 'Number of PRs',
                data: Object.values(mergeTimeBuckets),
                backgroundColor: '#28a745'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Populate PR table with recent data
function populatePRTable() {
    const tbody = document.getElementById('prTableBody');
    tbody.innerHTML = '';
    
    // Show last 10 PRs
    const recentPRs = prData.slice(0, 10);
    
    recentPRs.forEach(pr => {
        const row = tbody.insertRow();
        
        const statusClass = pr.is_merged === 'True' ? 'status-merged' : 
                           pr.state === 'open' ? 'status-open' : 'status-closed';
        const status = pr.is_merged === 'True' ? 'Merged' : 
                      pr.state === 'open' ? 'Open' : 'Closed';
        
        const mergeTime = pr.merge_time_hours ? 
            parseFloat(pr.merge_time_hours).toFixed(1) + 'h' : '-';
        
        const createdDate = pr.created_at ? 
            new Date(pr.created_at).toLocaleDateString() : '-';
        
        row.innerHTML = `
            <td>#${pr.number}</td>
            <td>${pr.title}</td>
            <td>${pr.author}</td>
            <td class="${statusClass}">${status}</td>
            <td>${createdDate}</td>
            <td>${mergeTime}</td>
        `;
    });
}
