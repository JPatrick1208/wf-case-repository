document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');

  const toggleButton = document.getElementById('toggle-sidebar');
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');

  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    content.classList.toggle('sidebar-hidden');
  });

  // Close sidebar when clicking outside of it
  document.addEventListener('click', (event) => {
    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickOnToggle = toggleButton.contains(event.target);

    if (!isClickInsideSidebar && !isClickOnToggle && !sidebar.classList.contains('hidden')) {
      sidebar.classList.add('hidden');
      content.classList.add('sidebar-hidden');
    }
  });

  // Fetch data from the server
  fetch('/DS')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      console.log('Data received:', data);
      updateTotalCounts(data); // Update total counts
      updateCaseStatusChart(data);
      updatePriorityChart(data, 'All');
      populatePriorityDropdown(data['Case Details']);
      populateProductDropdown(data['Case Details']);
      populateResolutionDropdown(data['Case Details']);
      updateTopProductsChart(data, 'All');
      updateResolutionChart(data, 'All');
      displayTable('Case Details'); // Automatically display the 'Case Details' sheet
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });

  const clearButton = document.getElementById('clear-button');
  const searchInput = document.getElementById('search-input');

  if (clearButton && searchInput) {
    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      filterTable();
    });
  }

  const runScriptButton = document.getElementById('runScript');
  const lastUpdateElement = document.getElementById('lastUpdate');

  if (runScriptButton) {
    runScriptButton.addEventListener('click', runScript);
  }

  function runScript() {
    if (runScriptButton) {
      runScriptButton.innerHTML = 'LOADING<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>';
      runScriptButton.style.color = '#ff0033';
      runScriptButton.classList.add('loading-animation');
      runScriptButton.disabled = true;

      fetch('/run-script')
        .then(response => response.text())
        .then(data => {
          runScriptButton.innerHTML = 'UPDATE DATASOURCE';
          runScriptButton.style.color = '';
          runScriptButton.classList.remove('loading-animation');
          runScriptButton.disabled = false;

          alert(`Success: ${data}`);

          const now = new Date();
          lastUpdateElement.innerHTML = `Last Update:<br>&nbsp;${now.toLocaleString()}`;
          localStorage.setItem('lastUpdate', now.toLocaleString());

          location.reload();
        })
        .catch(error => {
          console.error('Error:', error);

          runScriptButton.innerHTML = 'UPDATE DATASOURCE';
          runScriptButton.style.color = '';
          runScriptButton.classList.remove('loading-animation');
          runScriptButton.disabled = false;

          alert(`Error: ${error.message || error}`);
        });
    }
  }

  setInterval(runScript, 3600000);

  window.addEventListener('load', () => {
    const lastUpdate = localStorage.getItem('lastUpdate');
    if (lastUpdate) {
      lastUpdateElement.innerHTML = `Last Update:<br><br>&nbsp;${lastUpdate}`;
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', debounce(filterTable, 300));
  }

  const viewTxtBtn = document.getElementById('view-txt-btn');
  if (viewTxtBtn) {
    viewTxtBtn.addEventListener('click', DisplayToText, false);
  }

  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToExcel, false);
  }

  const dashlets = document.querySelectorAll('.dashlet');
  dashlets.forEach(dashlet => {
    dashlet.addEventListener('click', () => {
      const sheetName = dashlet.getAttribute('data-sheet');
      if (sheetName) {
        displayTable(sheetName);
      }
    });
  });
});

/**
 * Updates counts and progress bars based on the provided data.
 * @param {Object} data - The data object containing case details.
 */
function updateTotalCounts(data) {
  console.log('Updating counts');

  function countNonEmpty(sheetData) {
    if (!Array.isArray(sheetData) || sheetData.length <= 1) {
      console.error('Expected an array with more than one row but got:', sheetData);
      return 0;
    }
    return sheetData.slice(1).reduce((count, row) => {
      if (row[5]) { // Column F is index 5 (0-based index)
        count++;
      }
      return count;
    }, 0);
  }

  const totalCaseCount = data['Case Details'] ? countNonEmpty(data['Case Details']) : 0;
  console.log('Total Case Count:', totalCaseCount);
  document.getElementById('total-cases-count').innerText = totalCaseCount;

  const openCasesCount = data['Open Cases'] ? countNonEmpty(data['Open Cases']) : 0;
  document.getElementById('total-open-cases-count').innerText = openCasesCount;

  const technicalAnalysisCount = data['Technical Analysis'] ? countNonEmpty(data['Technical Analysis']) : 0;
  document.getElementById('technical-analysis-count').innerText = technicalAnalysisCount;

  const defectCount = data['Defect Cases'] ? countNonEmpty(data['Defect Cases']) : 0;
  document.getElementById('defect-cases-count').innerText = defectCount;

  const pendingRcaCount = data['Pending RCA'] ? countNonEmpty(data['Pending RCA']) : 0;
  document.getElementById('pending-rca-count').innerText = pendingRcaCount;

  const resolvedCasesCount = data['Resolved'] ? countNonEmpty(data['Resolved']) : 0;
  document.getElementById('resolved-cases-count').innerText = resolvedCasesCount;

  // Add logic for counting "Next Steps" based on the "No Next Steps" worksheet
  const noNextStepsCount = data['No Next Steps'] ? countNonEmpty(data['No Next Steps']) : 0;
  document.getElementById('no-next-steps-count').innerText = noNextStepsCount;
}

/**
 * Checks if a value is a valid Excel date.
 * @param {number} value - The value to check.
 * @returns {boolean} - True if the value is a valid Excel date, false otherwise.
 */
function isValidExcelDate(value) {
  return !isNaN(value) && value >= 0;
}

/**
 * Formats a date/time value.
 * @param {number} value - The value to format.
 * @param {boolean} isClosedDate - Whether the value is a closed date.
 * @returns {string} - The formatted date/time string.
 */
function formatDateTime(value, isClosedDate = false) {
  if (value === "" || value === null || value === undefined) {
    return value;
  }
  if (isValidExcelDate(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) {
      return value;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours() % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
    return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
  }
  return value;
}

/**
 * Displays a table based on the sheet name.
 * @param {string} sheetName - The name of the sheet to display.
 */
function displayTable(sheetName) {
  const table = document.getElementById('data-table');
  const tableHeader = document.getElementById('table-header');
  const tableBody = document.getElementById('table-body');

  tableHeader.innerHTML = '';
  tableBody.innerHTML = '';

  fetch('/DS')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      const sheetData = data[sheetName];
      if (sheetData) {
        const headerRow = document.createElement('tr');
        sheetData[0].forEach(cell => {
          const th = document.createElement('th');
          th.textContent = cell;
          th.style.whiteSpace = 'nowrap';
          headerRow.appendChild(th);
        });
        tableHeader.appendChild(headerRow);

        sheetData.slice(1).forEach(row => {
          const tr = document.createElement('tr');
          tr.addEventListener('click', () => showPopup(row));
          row.forEach((cell, index) => {
            const td = document.createElement('td');
            td.style.whiteSpace = 'nowrap';
            if (index === 1) {
              td.textContent = formatDateTime(cell);
            } else if (index === 2) {
              td.textContent = formatDateTime(cell, true);
            } else if ([26, 27, 28].includes(index)) {
              const a = document.createElement('a');
              a.href = cell;
              a.target = '_blank';
              a.textContent = cell;
              a.style.color = '#50fa7b';
              td.appendChild(a);
            } else {
              td.textContent = cell;
            }
            tr.appendChild(td);
          });
          tableBody.appendChild(tr);
        });

        table.style.display = 'table';
      } else {
        console.error(`Sheet ${sheetName} not found`);
      }
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });
}

/**
 * Updates the case status chart.
 * @param {Object} data - The data object containing case details.
 */
function updateCaseStatusChart(data) {
  const canvas = document.getElementById('summaryChart');
  const ctx = canvas.getContext('2d');

  // Define the base colors for the datasets
  const baseColors = [
    'rgba(54, 59, 116, 0.6)',
    'rgba(103, 56, 136, 0.6)',
    'rgba(239, 79, 145, 0.6)',
    'rgba(199, 157, 215, 0.6)',
    'rgba(77, 27, 123, 0.6)',
    'rgba(255, 0, 193, 0.6)',
    'rgba(150, 0, 255, 0.6)',
    'rgba(73, 0, 255, 0.6)',
    'rgba(0, 184, 255, 0.6)',
    'rgba(0, 255, 249, 0.6)'
  ];

  // Generate dynamic colors if there are more statuses than predefined colors
  const colors = ['Open Cases', 'Technical Analysis', 'Defect', 'Pending RCA', 'Resolved'].map((_, index) => baseColors[index % baseColors.length]);

  const summaryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Open Cases', 'Technical Analysis', 'Defect', 'Pending RCA', 'Resolved'],
      datasets: [
        {
          label: 'CASE STATUS',
          data: [
            data['Open Cases'] ? data['Open Cases'].length - 1 : 0,
            data['Technical Analysis'] ? data['Technical Analysis'].length - 1 : 0,
            data['Defect Cases'] ? data['Defect Cases'].length - 1 : 0,
            data['Pending RCA'] ? data['Pending RCA'].length - 1 : 0,
            data['Resolved'] ? data['Resolved'].length - 1 : 0
          ],
          backgroundColor: colors[1],
          borderColor: colors[0],
          borderWidth: 2,
          fill: false,
          pointBackgroundColor: colors[0],
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: colors[0],
          pointHoverBorderColor: '#fff',
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              family: 'Inter',
              size: 14,
              weight: 'bold'
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              family: 'Inter',
              size: 14,
              weight: 'bold'
            }
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'CASE STATUS',
          font: {
            family: 'Inter',
            size: 24,
            weight: 'bold'
          },
          padding: {
            top: 20,
            bottom: 30
          },
          color: 'rgba(84, 246, 224, 1)'
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleFont: {
            family: 'Inter',
            size: 18,
            weight: 'bold'
          },
          bodyFont: {
            family: 'Inter',
            size: 16
          },
          footerFont: {
            family: 'Inter',
            size: 14,
            style: 'italic'
          },
          callbacks: {
            label: function(tooltipItem) {
              return ` ${tooltipItem.label}: ${tooltipItem.raw}`;
            }
          }
        },
        legend: {
          display: false,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 10,
            font: {
              family: 'Inter',
              size: 15,
              weight: 'bold'
            },
            color: 'rgba(255, 255, 255, 1)'
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#5EFA9D',
          font: {
            family: 'Inter',
            size: 16,
            weight: 'bold'
          },
          formatter: (value, context) => {
            return value > 0 ? value : '';
          }
        }
      },
      animation: {
        duration: 2000,
        easing: 'easeOutBounce'
      }
    },
    plugins: [ChartDataLabels]
  });
}

/**
 * Updates the priority chart based on the provided data and coverage.
 * @param {Object} data - The data object containing case details.
 * @param {string} coverage - The coverage filter for the chart.
 */
function updatePriorityChart(data, coverage) {
  const canvas = document.getElementById('priorityChart');
  const ctx = canvas.getContext('2d');

  if (window.priorityChartInstance) {
    window.priorityChartInstance.destroy();
  }

  const caseDetails = data['Case Details'];
  if (!caseDetails || caseDetails.length <= 1) {
    console.error('Case Details data is missing or invalid');
    return;
  }

  const priorityCounts = {};
  caseDetails.slice(1).forEach(row => {
    const priority = row[15];
    const caseCoverage = row[0];
    if (priority && (coverage === 'All' || caseCoverage === coverage)) {
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    }
  });

  const sortedPriority = Object.entries(priorityCounts).sort((a, b) => b[1] - a[1]);
  const priorityLabels = sortedPriority.map(entry => entry[0]);
  const priorityCountsData = sortedPriority.map(entry => entry[1]);

  const baseColors = [
    'rgba(150, 0, 255, 0.6)',
    'rgba(73, 0, 255, 0.6)',
    'rgba(0, 184, 255, 0.6)',
    'rgba(255, 8, 74, 0.6)',
    'rgba(0, 255, 249, 0.6)'
  ];

  const colors = priorityLabels.map((_, index) => baseColors[index % baseColors.length]);

  window.priorityChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: priorityLabels,
      datasets: [{
        label: 'CASE PRIORITY',
        data: priorityCountsData,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace('0.6', '1')),
        borderWidth: 2,
        hoverBackgroundColor: colors.map(color => color.replace('0.6', '0.8')),
        hoverBorderColor: colors.map(color => color.replace('0.6', '1')),
        hoverBorderWidth: 2,
      }]
    },
    options: {
      indexAxis: 'y', // This makes the chart horizontal
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: 'rgba(200, 200, 200, 0.2)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              family: 'Inter',
              size: 14,
              weight: 'bold'
            }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              family: 'Inter',
              size: 14,
              weight: 'bold'
            }
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'CASE PRIORITY',
          font: {
            family: 'Inter',
            size: 24,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 30
          },
          color: 'rgba(84, 246, 224, 1)'
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleFont: {
            family: 'Inter',
            size: 18,
            weight: 'bold'
          },
          bodyFont: {
            family: 'Inter',
            size: 16
          },
          footerFont: {
            family: 'Inter',
            size: 14,
            style: 'italic'
          },
          callbacks: {
            label: function(tooltipItem) {
              return ` ${tooltipItem.label}: ${tooltipItem.raw}`;
            }
          }
        },
        legend: {
          display: false,
          position: 'right',
          labels: {
            font: {
              family: 'Inter',
              size: 16,
              weight: 'bold'
            },
            color: 'rgba(0, 204, 255, 1)'
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#5EFA9D',
          font: {
            family: 'Inter',
            size: 18,
            weight: 'bold'
          },
          formatter: (value, context) => {
            return value;
          }
        },
        zoom: {
          pan: {
            enabled: false,
            mode: 'xy'
          },
          zoom: {
            wheel: {
              enabled: false
            },
            pinch: {
              enabled: false
            },
            mode: 'xy'
          }
        }
      },
      animation: {
        duration: 2000,
        easing: 'easeOutBounce'
      }
    },
    plugins: [ChartDataLabels]
  });
}

/**
 * Updates the top 10 products chart based on the provided data and coverage.
 * @param {Object} data - The data object containing case details.
 * @param {string} coverage - The coverage filter for the chart.
 */
function updateTopProductsChart(data, coverage) {
  const canvas = document.getElementById('topProductsChart');
  const ctx = canvas.getContext('2d');

  // Destroy existing chart instance if it exists
  if (window.topProductsChartInstance) {
    window.topProductsChartInstance.destroy();
  }

  // Validate case details data
  const caseDetails = data['Case Details'];
  if (!Array.isArray(caseDetails) || caseDetails.length <= 1) {
    console.error('Case Details data is missing or invalid');
    return;
  }

  // Count product occurrences based on coverage
  const productCounts = caseDetails.slice(1).reduce((counts, row) => {
    const product = row[17];
    const caseCoverage = row[0];
    if (product && (coverage === 'All' || caseCoverage === coverage)) {
      counts[product] = (counts[product] || 0) + 1;
    }
    return counts;
  }, {});

  // Sort products and get top 10
  const sortedProducts = Object.entries(productCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 10);

  const productLabels = sortedProducts.map(([product]) => product);
  const productCountsData = sortedProducts.map(([, count]) => count);

  // Define colors
  const colors = [
    'rgba(247, 37, 133, .6)',
    'rgba(181, 23, 158, .6)',
    'rgba(114, 9, 183, .6)',
    'rgba(86, 11, 173, .6)',
    'rgba(72, 12, 168, .6)',
    'rgba(58, 12, 163, .6)',
    'rgba(63, 55, 201, .6)',
    'rgba(67, 97, 238, .6)',
    'rgba(72, 149, 239, .6)',
    'rgba(76, 201, 240, .6)'
  ];

  // Create the chart
  window.topProductsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: productLabels,
      datasets: [{
        label: 'TOP 10 PRODUCTS',
        data: productCountsData,
        backgroundColor: colors,
        borderColor: 'rgb(0, 255, 255)',
        borderWidth: 2,
        hoverBackgroundColor: colors.map(color => color.replace('0.6', '0.8')),
        hoverBorderColor: colors.map(color => color.replace('0.6', '1')),
        hoverBorderWidth: 2,
      }]
    },
    options: {
      indexAxis: 'x',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(200, 200, 200, 0.2)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'TOP 10 PRODUCTS',
          font: {
            family: 'Inter',
            size: 24,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 30
          },
          color: 'rgba(84, 246, 224, 1)'
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleFont: {
            family: 'Inter',
            size: 18,
            weight: 'bold'
          },
          bodyFont: {
            family: 'Inter',
            size: 16
          },
          footerFont: {
            family: 'Inter',
            size: 14,
            style: 'italic'
          },
          callbacks: {
            label: tooltipItem => ` ${tooltipItem.label}: ${tooltipItem.raw}`
          }
        },
        legend: {
          display: false
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#5EFA9D',
          font: {
            family: 'Inter',
            size: 15,
            weight: 'bold'
          }
        },
        zoom: {
          pan: {
            enabled: false,
            mode: 'xy'
          },
          zoom: {
            wheel: {
              enabled: false
            },
            pinch: {
              enabled: false
            },
            mode: 'xy'
          }
        }
      },
      animation: {
        duration: 3000,
        easing: 'easeOutQuad'
      }
    },
    plugins: [ChartDataLabels]
  });

  // Add bevel effect to bars
  const originalDraw = Chart.controllers.bar.prototype.draw;
  Chart.controllers.bar.prototype.draw = function() {
    const ctx = this.chart.ctx;

    // Call the original draw method
    originalDraw.call(this);

    // Apply bevel effect
    this.getMeta().data.forEach((bar) => {
      const model = bar._model;
      if (model) {
        const { x, y, width, height } = model;

        // Set shadow properties for bevel effect
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // Light color for bevel
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Shadow color
        ctx.shadowOffsetX = 2; // Horizontal shadow offset
        ctx.shadowOffsetY = 2; // Vertical shadow offset
        ctx.shadowBlur = 5; // Shadow blur

        // Draw the bevel effect
        ctx.fillRect(x, y, width, height);
        ctx.restore();
      }
    });
  };
}

/**
 * Updates the resolution chart based on the provided data and coverage.
 * @param {Object} data - The data object containing case details.
 * @param {string} coverage - The coverage filter for the chart.
 */
function updateResolutionChart(data, coverage) {
  const canvas = document.getElementById('resolutionChart');
  const ctx = canvas.getContext('2d');

  // Destroy existing chart instance if it exists
  if (window.resolutionChartInstance) {
    window.resolutionChartInstance.destroy();
  }

  // Validate case details data
  const caseDetails = data['Case Details'];
  if (!Array.isArray(caseDetails) || caseDetails.length <= 1) {
    console.error('Case Details data is missing or invalid');
    return;
  }

  // Count resolution occurrences based on coverage
  const resolutionCounts = caseDetails.slice(1).reduce((counts, row) => {
    const resolution = row[19];
    const caseCoverage = row[0];
    if (resolution && (coverage === 'All' || caseCoverage === coverage)) {
      counts[resolution] = (counts[resolution] || 0) + 1;
    }
    return counts;
  }, {});

  // Sort resolutions and get top 10
  const sortedResolution = Object.entries(resolutionCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 10);

  const resolutionLabels = sortedResolution.map(([resolution]) => resolution);
  const resolutionCountsData = sortedResolution.map(([, count]) => count);

  // Define colors
  const colors = [
    'rgba(247, 37, 133, .6)',
    'rgba(181, 23, 158, .6)',
    'rgba(114, 9, 183, .6)',
    'rgba(86, 11, 173, .6)',
    'rgba(72, 12, 168, .6)',
    'rgba(58, 12, 163, .6)',
    'rgba(63, 55, 201, .6)',
    'rgba(67, 97, 238, .6)',
    'rgba(72, 149, 239, .6)',
    'rgba(76, 201, 240, .6)'
  ];

  // Create the chart
  window.resolutionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: resolutionLabels,
      datasets: [{
        label: 'TOP 10 RESOLUTIONS',
        data: resolutionCountsData,
        backgroundColor: colors,
        borderColor: 'rgb(0, 255, 255)',
        borderWidth: 2,
        hoverBackgroundColor: colors.map(color => color.replace('0.6', '0.8')),
        hoverBorderColor: colors.map(color => color.replace('0.6', '1')),
        hoverBorderWidth: 2,
      }]
    },
    options: {
      indexAxis: 'x',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(200, 200, 200, 0.2)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'TOP 10 RESOLUTIONS',
          font: {
            family: 'Inter',
            size: 24,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 30
          },
          color: 'rgba(84, 246, 224, 1)'
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleFont: {
            family: 'Inter',
            size: 18,
            weight: 'bold'
          },
          bodyFont: {
            family: 'Inter',
            size: 16
          },
          footerFont: {
            family: 'Inter',
            size: 14,
            style: 'italic'
          },
          callbacks: {
            label: tooltipItem => ` ${tooltipItem.label}: ${tooltipItem.raw}`
          }
        },
        legend: {
          display: false
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#5EFA9D',
          font: {
            family: 'Inter',
            size: 15,
            weight: 'bold'
          }
        },
        zoom: {
          pan: {
            enabled: false,
            mode: 'xy'
          },
          zoom: {
            wheel: {
              enabled: false
            },
            pinch: {
              enabled: false
            },
            mode: 'xy'
          }
        }
      },
      animation: {
        duration: 3000,
        easing: 'easeOutQuad'
      }
    },
    plugins: [ChartDataLabels]
  });

  // Add bevel effect to bars
  const originalDraw = Chart.controllers.bar.prototype.draw;
  Chart.controllers.bar.prototype.draw = function() {
    const ctx = this.chart.ctx;

    // Call the original draw method
    originalDraw.call(this);

    // Apply bevel effect
    this.getMeta().data.forEach((bar) => {
      const model = bar._model;
      if (model) {
        const { x, y, width, height } = model;

        // Set shadow properties for bevel effect
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // Light color for bevel
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Shadow color
        ctx.shadowOffsetX = 2; // Horizontal shadow offset
        ctx.shadowOffsetY = 2; // Vertical shadow offset
        ctx.shadowBlur = 5; // Shadow blur

        // Draw the bevel effect
        ctx.fillRect(x, y, width, height);
        ctx.restore();
      }
    });
  };
}

/**
 * Populates the priority dropdown with unique values from the case details.
 * @param {Array} caseDetails - The array of case details.
 */
function populatePriorityDropdown(caseDetails) {
  const dropdown = document.getElementById('priority-dropdown');
  const uniqueValues = new Set();

  caseDetails.slice(1).forEach(row => {
    if (row[0]) {
      uniqueValues.add(row[0]);
    }
  });

  const allOption = document.createElement('option');
  allOption.value = 'All';
  allOption.textContent = 'All';
  dropdown.appendChild(allOption);

  uniqueValues.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    dropdown.appendChild(option);
  });

  dropdown.addEventListener('change', () => {
    const selectedCoverage = dropdown.value;
    fetch('/DS')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        updatePriorityChart(data, selectedCoverage);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  });
}

/**
 * Populates the dropdown with unique values from the case details.
 * @param {Array} caseDetails - The array of case details.
 */
function populateProductDropdown(caseDetails) {
  const dropdown = document.getElementById('product-dropdown');
  const uniqueValues = new Set();

  caseDetails.slice(1).forEach(row => {
    if (row[0]) {
      uniqueValues.add(row[0]);
    }
  });

  const allOption = document.createElement('option');
  allOption.value = 'All';
  allOption.textContent = 'All';
  dropdown.appendChild(allOption);

  uniqueValues.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    dropdown.appendChild(option);
  });

  dropdown.addEventListener('change', () => {
    const selectedCoverage = dropdown.value;
    fetch('/DS')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        updateTopProductsChart(data, selectedCoverage);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  });
}

/**
 * Populates the dropdown with unique values from the case details.
 * @param {Array} caseDetails - The array of case details.
 */
function populateResolutionDropdown(caseDetails) {
  const dropdown = document.getElementById('resolution-dropdown');
  const uniqueValues = new Set();

  caseDetails.slice(1).forEach(row => {
    if (row[0]) {
      uniqueValues.add(row[0]);
    }
  });

  const allOption = document.createElement('option');
  allOption.value = 'All';
  allOption.textContent = 'All';
  dropdown.appendChild(allOption);

  uniqueValues.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    dropdown.appendChild(option);
  });

  dropdown.addEventListener('change', () => {
    const selectedCoverage = dropdown.value;
    fetch('/DS')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        updateResolutionChart(data, selectedCoverage);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  });
}

/**
 * Debounces a function to limit the rate at which it is executed.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {Function} - The debounced function.
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Filters the table based on the search input.
 */
function filterTable() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const table = document.getElementById('data-table');
  const rows = table.querySelectorAll('tbody tr');

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    let matchFound = false;

    cells.forEach(cell => {
      const cellText = cell.textContent.toLowerCase();
      if (cellText.includes(query)) {
        matchFound = true;
        cell.innerHTML = cell.textContent.replace(new RegExp(`(${query})`, 'gi'), '<span class="highlight">$1</span>');
      } else {
        cell.innerHTML = cell.textContent;
      }
    });

    row.style.display = matchFound ? '' : 'none';
  });
}

/**
 * Displays the table data in a text format in a new pop-up window.
 */
function DisplayToText() {
  const table = document.getElementById('data-table');
  if (!table) {
    console.error("Table with id 'excel-table' not found.");
    return;
  }

  const rows = Array.from(table.querySelectorAll('tr')).slice(1);

  let output = '';

  rows.forEach(row => {
    if (row.style.display !== 'none') {
      const cells = Array.from(row.children);

      const getCellValueByIndex = (index) => {
        if (index < 0 || index >= cells.length) {
          console.warn(`Column index ${index} is out of bounds.`);
          return 'N/A';
        }
        return cells[index].textContent.trim();
      };

      const createHyperlink = (text) => {
        if (text === 'N/A' || !text) return text;
        return `<a href="${text}" target="_blank" style="color: #50fa7b;">${text}</a>`;
      };

      output += `<div class="entry">`;
      output += `<p><span class="label">REPORTS TO:</span> ${getCellValueByIndex(24)}</p>`;
      output += `<p><span class="label">CASE OWNER:</span> ${getCellValueByIndex(23)}</p>`;
      output += `</br>`;
      output += `<p><span class="label">CASE AGE (DAYS):</span> ${getCellValueByIndex(4)}</p>`;
      output += `<p><span class="label">CASE NUMBER:</span> ${getCellValueByIndex(5)} - ${createHyperlink(getCellValueByIndex(26))}</p>`;
      output += `<p><span class="label">CVS TICKET:</span> ${getCellValueByIndex(6)}</p>`;
      output += `<p><span class="label">TAC TICKET:</span> ${getCellValueByIndex(7)} - ${createHyperlink(getCellValueByIndex(27))}</p>`;
      output += `<p><span class="label">DEV TICKET:</span> ${getCellValueByIndex(8)} - ${createHyperlink(getCellValueByIndex(28))}</p>`;
      output += `<p><span class="label">PARTNER TICKET:</span> ${getCellValueByIndex(10)}</p>`;
      output += `<p><span class="label">PRIORITY:</span> ${getCellValueByIndex(15)}</p>`;
      output += `<p><span class="label">SUBJECT:</span> ${getCellValueByIndex(14)}</p>`;
      output += `<p><span class="label">STATUS:</span> ${getCellValueByIndex(20)}</p>`;
      output += `</div><hr>`;
    }
  });

  if (!output) {
    output = '<p>No data available or all rows are hidden.</p>';
  }

  const width = 900;
  const height = 700;
  const left = (screen.width / 2) - (width / 2);
  const top = (screen.height / 2) - (height / 2);

  const popup = window.open('', '_blank', `width=${width},height=${height},left=${left},top=${top}`);
  popup.document.write(`
<html>
<head>
    <style>
        body {
            font-family: 'Calibri', sans-serif;
            padding: 20px;
            font-size: 16px;
			background-color: #0a0a0a;
            background-size: cover;
            background-attachment: fixed;
            color: #FFFFFF;
            transform: scale(1);
            transform-origin: top;
        }

        .entry {
            margin-bottom: 20px;
        }

        .label {
            font-weight: bold;
            color: #00BFFF;
        }

        p {
            margin: 10px 0;
        }

        hr {
            border: 0;
            height: 1px;
            background: #44475a;
            margin: 20px 0;
        }

        a {
            text-decoration: none;
            color: #00BFFF;
        }

        a:hover {
            text-decoration: underline;
        }
    </style>
</head>

<body>
    ${output}
</body>

</html>
`);
  popup.document.close();
}

/**
 * Exports the table data to an Excel file.
 */
function exportToExcel() {
  const table = document.getElementById('data-table');
  if (!table) {
    alert('No data to export.');
    return;
  }

  const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tr:not(:first-child)')).filter(tr => tr.style.display !== 'none').map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!gridlines'] = false;

  headers.forEach((_, index) => {
    const cellAddress = XLSX.utils.encode_cell({
      c: index,
      r: 0
    });
    if (!ws[cellAddress].s) ws[cellAddress].s = {};
    ws[cellAddress].s.alignment = {
      horizontal: 'center'
    };
  });

  const range = XLSX.utils.decode_range(ws['!ref']);
  ws['!ref'] = `A1:AF${range.e.r + 1}`;
  XLSX.utils.sheet_add_aoa(ws, wsData, {
    origin: 'A1'
  });

  ws['!cols'] = headers.map(() => ({
    wpx: 100
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, 'Custom Report.xlsx');

  alert('Export complete: "Custom Report.xlsx"');
}

/**
 * Opens multiple links in new tabs with a delay between each.
 */
function F9links() {
  const urls = [
    "https://app-atl.five9.com/",
    "https://five9.okta.com/app/UserHome",
    "https://five9.lightning.force.com/lightning/r/Dashboard/01Z3r0000003biYEAQ/view",
    "https://five9inc.atlassian.net/jira/your-work"
  ];
  urls.forEach((url, index) => {
    setTimeout(() => {
      window.open(url, '_blank');
    }, index * 500);
  });
}

/**
 * Displays the modal with the selected row data.
 * @param {Array} rowData - The data of the selected row.
 */
function showPopup(rowData) {
  const modal = document.getElementById('myModal');
  const modalBody = document.getElementById('modal-body');
  const closeButton = document.getElementsByClassName('close-button')[0];

  let output = '<div>';
  const labels = [
    "Coverage",
    "Date/Time Opened",
    "Date/Time Closed",
    "Case Privacy",
    "Case Age (Days)",
    "Case Number",
    "CVS Ticket",
    "TAC ID",
    "DEV ID",
    "Service Request #",
    "Partner Case Number",
    "Service Interruption",
    "Case Escalated",
    "Account Name",
    "Subject",
    "Priority",
    "Service",
    "Product",
    "Topic",
    "Resolution Code",
    "Status",
    "Contact Name",
    "Alternate Contact Name",
    "Case Owner",
    "Reports to",
    "Still Open?",
    "SF Url",
    "TAC Url",
    "DEV Url",
    "Opened Date",
    "Next Steps Owner",
    "Next Steps",
    "Year"
  ];

  const selectedLabels = [
    "Coverage",
    "Date/Time Opened",
    "Date/Time Closed",
    "Case Privacy",
    "Case Age (Days)",
    "Case Number",
    "CVS Ticket",
    "TAC ID",
    "DEV ID",
    "Subject",
    "Priority",
    "Resolution Code",
    "Status",
    "Contact Name",
    "Alternate Contact Name",
    "Case Owner",
    "Reports to",
    "SF Url",
    "TAC Url",
    "Next Steps Owner",
    "Next Steps"
  ];

  rowData.forEach((cell, index) => {
    if (cell === "null") {
      cell = "";
    }
    if (index < labels.length && selectedLabels.includes(labels[index])) {
      let formattedCell = cell;
      if (index === 1 || index === 2) {
        formattedCell = formatDateTime(cell);
      } else if (labels[index] === "SF Url" || labels[index] === "TAC Url" || labels[index] === "DEV Url") {
        formattedCell = `<a href="${cell}" target="_blank">${cell}</a>`;
      }
      output += `<p><strong style="color: #00BFFF;">${labels[index]}:</strong> ${formattedCell}</p>`;
    }
  });
  output += '</div>';

  modalBody.innerHTML = output;
  modal.style.display = 'block';

  closeButton.onclick = function () {
    modal.style.display = 'none';
  }

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  }
}

/**
 * Formats a date/time value.
 * @param {number} value - The value to format.
 * @returns {string} - The formatted date/time string.
 */
function formatDateTime(value, isClosedDate = false) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  if (isValidExcelDate(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) {
      return value;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours() % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
    return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
  }
  return value;
}
