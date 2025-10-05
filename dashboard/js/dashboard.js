// Dashboard JavaScript with Fixed Filtering and Timestamp
let metricsData = {};
let prData = [];
let filteredData = [];
let charts = {};

// Load data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    updateLastUpdateTime();
});

async function loadData() {
    try {
        // Load metrics
        const metricsResponse = await fetch('data/metrics.json');
        metricsData = await metricsResponse.json();

        // Load PR data
        const prResponse = await fetch('data/pr_data.csv');
        const csvText = await prResponse.text();
        prData = parseCSV(csvText);
        filteredData = [...prData];

        // Initialize dashboard
        populateAuthorFilter();
        updateMetricsDisplay();
        createAllCharts();
        populatePRTable();

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('errorMessage').style.display = 'block';
    }
}

function updateLastUpdateTime() {
    // Try to get the last update time from the data
    fetch('data/last_update.txt')
        .then(response => response.text())
        .then(timestamp => {
            const updateTime = new Date(timestamp.trim());

            // Format the date nicely
            const options = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Europe/Berlin'
            };

            const formattedTime = updateTime.toLocaleString('en-US', options);
            document.getElementById('lastUpdateTime').textContent = formattedTime + ' (Berlin Time)';

            // Calculate how long ago it was updated
            const now = new Date();
            const diffHours = Math.floor((now - updateTime) / (1000 * 60 * 60));

            const statusElement = document.getElementById('updateStatus');
            if (diffHours < 1) {
                statusElement.textContent = '● Just Updated';
                statusElement.style.color = '#4ade80';
            } else if (diffHours < 24) {
                statusElement.textContent = `● ${diffHours}h ago`;
                statusElement.style.color = '#4ade80';
            } else {
                const diffDays = Math.floor(diffHours / 24);
                statusElement.textContent = `● ${diffDays}d ago`;
                statusElement.style.color = diffDays > 7 ? '#f59e0b' : '#4ade80';
            }
        })
        .catch(error => {
            console.error('Error loading update time:', error);
            document.getElementById('lastUpdateTime').textContent = 'Unknown';
            document.getElementById('updateStatus').textContent = '● Offline';
            document.getElementById('updateStatus').style.color = '#ef4444';
        });
}

function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] ? values[index].trim() : '';
        });

        data.push(row);
    }

    return data;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);

    return values;
}

function populateAuthorFilter() {
    const authors = [...new Set(prData.map(pr => pr.author))].sort();
    const select = document.getElementById('authorFilter');

    authors.forEach(author => {
        const option = document.createElement('option');
        option.value = author;
        option.textContent = author;
        select.appendChild(option);
    });
}

function applyFilters() {
    const dateRange = document.getElementById('dateRangeFilter').value;
    const status = document.getElementById('statusFilter').value;
    const type = document.getElementById('typeFilter').value;
    const author = document.getElementById('authorFilter').value;

    console.log('Applying filters:', { dateRange, status, type, author });

    filteredData = prData.filter(pr => {
        // Date filter
        if (dateRange !== 'all') {
            const prDate = new Date(pr.created_at);
            const daysAgo = parseInt(dateRange);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
            if (prDate < cutoffDate) return false;
        }

        // Status filter
        if (status !== 'all') {
            if (status === 'merged' && pr.is_merged !== 'True') return false;
            if (status === 'open' && pr.state !== 'open') return false;
            if (status === 'closed' && pr.state === 'open') return false;
            if (status === 'closed' && pr.is_merged === 'True') return false;
        }

        // Type filter - Data Contract PRs
        if (type !== 'all') {
            // Check if PR has data-contract label
            const labels = pr.labels ? pr.labels.toLowerCase() : '';
            const hasDataContractLabel = labels.includes('data-contract') ||
                                        pr.has_data_contract_label === 'True';

            if (type === 'data-contract' && !hasDataContractLabel) return false;
            if (type === 'non-data-contract' && hasDataContractLabel) return false;
        }

        // Author filter
        if (author !== 'all' && pr.author !== author) return false;

        return true;
    });

    console.log('Filtered data count:', filteredData.length);

    updateMetricsDisplay();
    updateCharts();
    populatePRTable();
}

function updateMetricsDisplay() {
    const data = filteredData.length > 0 ? filteredData : prData;

    // Calculate metrics from filtered data
    const totalPRs = data.length;
    const mergedPRs = data.filter(pr => pr.is_merged === 'True').length;
    const mergeRate = totalPRs > 0 ? (mergedPRs / totalPRs * 100).toFixed(1) : 0;

    const mergeTimes = data
        .filter(pr => pr.merge_time_hours && pr.merge_time_hours !== '')
        .map(pr => parseFloat(pr.merge_time_hours));
    const avgMergeTime = mergeTimes.length > 0
        ? (mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length).toFixed(1)
        : 0;

    const fastMerges = mergeTimes.filter(time => time < 24).length;
    const fastMergeRate = mergeTimes.length > 0
        ? (fastMerges / mergeTimes.length * 100).toFixed(1)
        : 0;

    const activeAuthors = new Set(data.map(pr => pr.author)).size;
    const reviewedPRs = data.filter(pr => parseInt(pr.review_comments) > 0).length;
    const reviewCoverage = totalPRs > 0 ? (reviewedPRs / totalPRs * 100).toFixed(1) : 0;

    // Update display
    document.getElementById('totalPRs').textContent = totalPRs;
    document.getElementById('mergeRate').textContent = mergeRate + '%';
    document.getElementById('avgMergeTime').textContent = avgMergeTime + 'h';
    document.getElementById('activeAuthors').textContent = activeAuthors;
    document.getElementById('reviewCoverage').textContent = reviewCoverage + '%';
    document.getElementById('fastMergeRate').textContent = fastMergeRate + '%';
}

function createAllCharts() {
    createTimelineChart();
    createStatusChart();
    createAuthorsChart();
    createMergeSpeedChart();
    createReviewTrendsChart();
}

function createTimelineChart() {
    const ctx = document.getElementById('timelineChart').getContext('2d');

    const monthlyData = {};
    filteredData.forEach(pr => {
        if (pr.created_at) {
            const date = new Date(pr.created_at);
            const monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        }
    });

    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);

    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedMonths,
            datasets: [{
                label: 'Pull Requests',
                data: sortedMonths.map(m => monthlyData[m] || 0),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createStatusChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');

    const statusCounts = {
        open: filteredData.filter(pr => pr.state === 'open' && pr.is_merged !== 'True').length,
        merged: filteredData.filter(pr => pr.is_merged === 'True').length,
        closed: filteredData.filter(pr => pr.state === 'closed' && pr.is_merged !== 'True').length
    };

    charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Merged', 'Open', 'Closed'],
            datasets: [{
                data: [statusCounts.merged, statusCounts.open, statusCounts.closed],
                backgroundColor: ['#48bb78', '#4299e1', '#f56565']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15 }
                }
            }
        }
    });
}

function createAuthorsChart() {
    const ctx = document.getElementById('authorsChart').getContext('2d');

    const authorCounts = {};
    filteredData.forEach(pr => {
        authorCounts[pr.author] = (authorCounts[pr.author] || 0) + 1;
    });

    const sortedAuthors = Object.entries(authorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    charts.authors = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedAuthors.map(a => a[0].substring(0, 15)),
            datasets: [{
                label: 'Pull Requests',
                data: sortedAuthors.map(a => a[1]),
                backgroundColor: '#48bb78'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createMergeSpeedChart() {
    const ctx = document.getElementById('mergeSpeedChart').getContext('2d');

    const speedBuckets = {
        'Very Fast (< 1h)': 0,
        'Fast (1-24h)': 0,
        'Medium (1-7d)': 0,
        'Slow (1-4w)': 0,
        'Very Slow (> 4w)': 0
    };

    filteredData.forEach(pr => {
        if (pr.merge_time_hours && pr.merge_time_hours !== '') {
            const hours = parseFloat(pr.merge_time_hours);
            if (hours < 1) speedBuckets['Very Fast (< 1h)']++;
            else if (hours <= 24) speedBuckets['Fast (1-24h)']++;
            else if (hours <= 168) speedBuckets['Medium (1-7d)']++;
            else if (hours <= 672) speedBuckets['Slow (1-4w)']++;
            else speedBuckets['Very Slow (> 4w)']++;
        }
    });

    charts.mergeSpeed = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(speedBuckets),
            datasets: [{
                label: 'Number of PRs',
                data: Object.values(speedBuckets),
                backgroundColor: ['#48bb78', '#38a169', '#f6e05e', '#ed8936', '#f56565']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createReviewTrendsChart() {
    const ctx = document.getElementById('reviewTrendsChart').getContext('2d');

    // Set canvas height explicitly
    ctx.canvas.height = 320;
    ctx.canvas.style.height = '320px';

    const monthlyReviewData = {};
    filteredData.forEach(pr => {
        if (pr.created_at) {
            const date = new Date(pr.created_at);
            const monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
            if (!monthlyReviewData[monthKey]) {
                monthlyReviewData[monthKey] = { total: 0, reviewed: 0 };
            }
            monthlyReviewData[monthKey].total++;
            if (parseInt(pr.review_comments) > 0) {
                monthlyReviewData[monthKey].reviewed++;
            }
        }
    });

    const sortedMonths = Object.keys(monthlyReviewData).sort().slice(-12);
    const reviewCoverageData = sortedMonths.map(month => {
        const data = monthlyReviewData[month];
        return data && data.total > 0 ? (data.reviewed / data.total * 100).toFixed(1) : 0;
    });
    const volumeData = sortedMonths.map(month => monthlyReviewData[month]?.total || 0);

    charts.reviewTrends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: 'Review Coverage %',
                    data: reviewCoverageData,
                    borderColor: '#9333ea',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4
                },
                {
                    label: 'PR Volume',
                    data: volumeData,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Review Coverage %'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'PR Volume'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function updateCharts() {
    // Destroy and recreate charts with filtered data
    Object.values(charts).forEach(chart => chart.destroy());
    createAllCharts();
}

function populatePRTable() {
    const tbody = document.getElementById('prTableBody');
    tbody.innerHTML = '';

    const displayData = filteredData.slice(0, 15);

    displayData.forEach(pr => {
        const row = tbody.insertRow();

        const status = pr.is_merged === 'True' ? 'Merged' :
                      pr.state === 'open' ? 'Open' : 'Closed';
        const statusClass = status.toLowerCase();

        const mergeTime = pr.merge_time_hours && pr.merge_time_hours !== '' ?
            parseFloat(pr.merge_time_hours).toFixed(1) + 'h' : '-';

        const createdDate = pr.created_at ?
            new Date(pr.created_at).toLocaleDateString() : '-';

        // Parse and display labels properly
        let labels = '';
        if (pr.labels) {
            // Remove brackets and quotes, split by comma
            const labelArray = pr.labels.replace(/[\[\]']/g, '').split(',')
                .map(l => l.trim())
                .filter(l => l.length > 0);

            labels = labelArray.map(l => `<span class="label-badge">${l}</span>`).join('');
        }

        row.innerHTML = `
            <td><strong>#${pr.number}</strong></td>
            <td>${pr.title.substring(0, 50)}${pr.title.length > 50 ? '...' : ''}</td>
            <td>${pr.author}</td>
            <td><span class="status-badge status-${statusClass}">${status}</span></td>
            <td>${labels || '-'}</td>
            <td>${createdDate}</td>
            <td>${mergeTime}</td>
            <td>${pr.review_comments || '0'}</td>
        `;
    });
}

// Log when filters are applied to debug
window.applyFilters = applyFilters;