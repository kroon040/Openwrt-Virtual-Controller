'use strict';
'require view';
'require dom';
'require ui';
'require poll';
'require request';

function formatBytes(bytes, decimals = 1) { 
    if (!+bytes) return '0 B'; 
    const k=1024,dm=decimals<0?0:decimals,s=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(bytes)/Math.log(k)); 
    return `${parseFloat((bytes/Math.pow(k,i)).toFixed(dm))} ${s[i]}` 
}

function formatUptime(seconds) { 
    if(!seconds&&seconds!==0)return'N/A';
    if(seconds<60)return `${seconds}s`;
    const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60);
    let r='';if(d>0)r+=`${d}d `;if(h>0)r+=`${h}h `;if(m>0)r+=`${m}m`;
    return r.trim()||`${Math.floor(seconds)}s`
}

function getSignalClass(signalStr) {
    if(!signalStr) return '';
    const signalValue = parseInt(signalStr, 10);
    if(signalValue > -60) return 'signal-strong';
    if(signalValue > -75) return 'signal-medium';
    return 'signal-weak';
}

function getWifiVerColor(ver) {
    if (ver === 'WiFi7') return '#6f42c1';
    if (ver === 'WiFi6') return '#28a745';
    if (ver === 'WiFi5') return '#17a2b8';
    if (ver === 'WiFi4') return '#fd7e14';
    return '#6c757d';
}

return view.extend({
    load: function() {
        return request.get('/cgi-bin/get_clients');
    },

    render: function(response) {
        var clients = [];
        
        try {
            if (response && response.json) {
                var jsonData = response.json();
                if (Array.isArray(jsonData)) {
                    clients = jsonData;
                } else if (jsonData && typeof jsonData === 'object') {
                    clients = jsonData.clients || jsonData.data || [];
                }
            }
        } catch (e) {
            console.error('Error parsing client data:', e);
            clients = [];
        }

        var filterInput = E('input', {
            'type': 'text',
            'placeholder': _('Filter by MAC, IP, hostname, SSID, AP, etc...'),
            'style': 'width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px;'
        });

        var tableContainer = E('div', {
            'style': 'overflow-x: auto; margin-bottom: 15px;'
        });

        var table = E('table', {
            'class': 'table',
            'style': 'width: 100%; border-collapse: collapse;'
        });

        var thStyle = 'padding: 12px; border: 1px solid #ddd; text-align: left;';

        var tableHeader = E('thead', {}, [
            E('tr', {}, [
                E('th', { 'style': thStyle }, _('IP Address')),
                E('th', { 'style': thStyle }, _('Hostname')),
                E('th', { 'style': thStyle }, _('Station')),
                E('th', { 'style': thStyle }, _('SSID')),
                E('th', { 'style': thStyle }, _('WiFi')),
                E('th', { 'style': thStyle }, _('Band')),
                E('th', { 'style': thStyle }, _('Signal')),
                E('th', { 'style': thStyle }, _('RX / TX Rate')),
                E('th', { 'style': thStyle }, _('Total Data')),
                E('th', { 'style': thStyle }, _('Connected Time')),
                E('th', { 'style': thStyle }, _('AP'))
            ])
        ]);

        var tableBody = E('tbody', {});

        table.appendChild(tableHeader);
        table.appendChild(tableBody);
        tableContainer.appendChild(table);

        var lastUpdatedElem = E('p', {
            'style': 'font-style: italic; color: #666; margin-top: 15px;'
        });

        var tdStyle = 'padding: 8px 12px; border: 1px solid #ddd; vertical-align: middle;';

        var clientCountElem = E('span', {
            'style': 'margin-left: 12px; padding: 3px 10px; font-size: 14px; font-weight: normal; background: #17a2b8; color: white; border-radius: 12px; vertical-align: middle;'
        }, '0');

        var populateTable = function(clientList) {
            tableBody.innerHTML = '';

            var filterText = filterInput.value.toLowerCase().trim();
            var filteredClients = clientList.filter(function(client) {
                if (!filterText) return true;
                
                var searchText = [
                    client.mac      || '',
                    client.ip       || '',
                    client.hostname || '',
                    client.ssid     || '',
                    client.wifi_ver || '',
                    client.band     || '',
                    client.signal   || '',
                    client.ap       || ''
                ].join(' ').toLowerCase();
                
                return searchText.includes(filterText);
            });

            clientCountElem.textContent = filteredClients.length;

            if (filteredClients.length === 0) {
                var noResultsRow = E('tr', {}, [
                    E('td', { 
                        'colspan': '11',
                        'style': 'padding: 20px; text-align: center; color: #666; border: 1px solid #ddd;'
                    }, _('No matching clients found.'))
                ]);
                tableBody.appendChild(noResultsRow);
                return;
            }

            filteredClients.forEach(function(client) {
                var mac      = client.mac      || 'N/A';
                var ip       = client.ip       || '';
                var hostname = client.hostname || '';
                var ssid     = client.ssid     || 'N/A';
                var wifiVer  = client.wifi_ver || '';
                var band     = client.band     || 'N/A';
                var signal   = client.signal   || 'N/A';
                var rxRate   = client.rx_rate  || 'N/A';
                var txRate   = client.tx_rate  || 'N/A';
                var totalData = client.total_data || 0;
                var connTime  = client.conn_time  || 0;
                var ap       = client.ap       || 'N/A';

                var signalClass = getSignalClass(signal);
                var signalColor = signalClass === 'signal-strong' ? '#28a745'
                                : signalClass === 'signal-medium' ? '#ffc107'
                                : '#dc3545';

                var bandColor    = band === '5G' ? '#6f42c1' : '#17a2b8';
                var wifiVerColor = getWifiVerColor(wifiVer);

                var ipCell = E('td', { 'style': tdStyle + ' font-family: monospace; font-size: 0.92em;' });
                ipCell.textContent = ip;

                var hostnameCell = E('td', { 'style': tdStyle + ' font-weight: 500;' });
                hostnameCell.textContent = hostname;

                var stationCell = E('td', { 'style': tdStyle + ' font-family: monospace; font-size: 0.92em;' });
                stationCell.textContent = mac;

                var ssidCell = E('td', { 'style': tdStyle });
                ssidCell.textContent = ssid;

                var wifiVerCell = E('td', { 'style': tdStyle }, [
                    E('span', {
                        'style': 'display: inline-block; padding: 3px 8px; font-size: 12px; font-weight: bold; background: ' + wifiVerColor + '; color: white; border-radius: 4px;'
                    }, wifiVer)
                ]);

                var bandCell = E('td', { 'style': tdStyle }, [
                    E('span', {
                        'style': 'display: inline-block; padding: 3px 8px; font-size: 12px; font-weight: bold; background: ' + bandColor + '; color: white; border-radius: 4px;'
                    }, band)
                ]);

                var signalCell = E('td', { 'style': tdStyle + ' color: ' + signalColor + ';' });
                signalCell.textContent = signal;

                var rateCell = E('td', { 'style': tdStyle });
                rateCell.textContent = rxRate + ' / ' + txRate;

                var dataCell = E('td', { 'style': tdStyle });
                dataCell.textContent = formatBytes(totalData);

                var timeCell = E('td', { 'style': tdStyle });
                timeCell.textContent = formatUptime(connTime);

                var apCell = E('td', { 'style': tdStyle + ' font-weight: 500;' });
                apCell.textContent = ap;

                var row = E('tr', {
                    'style': 'border-bottom: 1px solid #ddd; transition: background-color 0.2s ease;',
                    'onmouseover': function() { this.style.backgroundColor = '#f8f9fa'; this.style.cursor = 'pointer'; },
                    'onmouseout':  function() { this.style.backgroundColor = ''; this.style.cursor = 'default'; }
                });

                row.appendChild(ipCell);
                row.appendChild(hostnameCell);
                row.appendChild(stationCell);
                row.appendChild(ssidCell);
                row.appendChild(wifiVerCell);
                row.appendChild(bandCell);
                row.appendChild(signalCell);
                row.appendChild(rateCell);
                row.appendChild(dataCell);
                row.appendChild(timeCell);
                row.appendChild(apCell);
                tableBody.appendChild(row);
            });
        };

        filterInput.addEventListener('input', function() {
            populateTable(clients);
        });
        
        populateTable(clients);
        lastUpdatedElem.textContent = _('Last updated') + ': ' + new Date().toLocaleTimeString();

        poll.add(function() {
            return request.get('/cgi-bin/get_clients').then(function(response) {
                try {
                    var newClients = [];
                    if (response && response.json) {
                        var jsonData = response.json();
                        if (Array.isArray(jsonData)) {
                            newClients = jsonData;
                        } else if (jsonData && typeof jsonData === 'object') {
                            newClients = jsonData.clients || jsonData.data || [];
                        }
                    }
                    clients = newClients;
                    populateTable(clients);
                    lastUpdatedElem.textContent = _('Last updated') + ': ' + new Date().toLocaleTimeString();
                } catch (e) {
                    console.error('Error updating client data:', e);
                }
            }).catch(function(error) {
                console.error('Error fetching client data:', error);
            });
        }, 5);

        var mainContainer = E('div', { 'class': 'cbi-map' }, [
            E('h2', {}, [ _('Wireless Clients Dashboard'), clientCountElem ]),
            filterInput,
            tableContainer,
            lastUpdatedElem
        ]);

        return mainContainer;
    },

    handleSaveApply: null, 
    handleSave: null, 
    handleReset: null
});
