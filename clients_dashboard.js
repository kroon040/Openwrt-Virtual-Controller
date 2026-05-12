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

        /* ── Responsive CSS ── */
        var styleEl = document.getElementById('wcd-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'wcd-style';
            styleEl.textContent = [
                /* Mobile: cards */
                '@media (max-width: 768px) {',
                '  #wcd-table thead { display: none; }',
                '  #wcd-table, #wcd-table tbody, #wcd-table tr, #wcd-table td { display: block; width: 100%; box-sizing: border-box; }',
                '  #wcd-table tr { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; padding: 4px 0; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }',
                '  #wcd-table td { border: none; border-bottom: 1px solid #f0f0f0; padding: 7px 14px; display: flex; justify-content: space-between; align-items: center; min-height: 36px; }',
                '  #wcd-table td:last-child { border-bottom: none; }',
                '  #wcd-table td::before { content: attr(data-label); font-weight: 600; font-size: 0.78em; color: #888; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; margin-right: 10px; }',
                '  #wcd-table td[data-label=""]::before { display: none; }',
                '  #wcd-wrap { overflow-x: visible; }',
                '}',
                /* Desktop: normal table */
                '@media (min-width: 769px) {',
                '  #wcd-table { width: 100%; border-collapse: collapse; }',
                '  #wcd-table th, #wcd-table td { padding: 8px 12px; border: 1px solid #ddd; vertical-align: middle; }',
                '  #wcd-table th { text-align: left; }',
                '  #wcd-table tr:hover td { background-color: #f8f9fa; }',
                '}'
            ].join('\n');
            document.head.appendChild(styleEl);
        }

        var filterInput = E('input', {
            'type': 'text',
            'placeholder': _('Filter by MAC, IP, hostname, SSID, AP, etc...'),
            'style': 'width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;'
        });

        var tableContainer = E('div', { 'id': 'wcd-wrap', 'style': 'overflow-x: auto; margin-bottom: 15px;' });
        var table          = E('table', { 'id': 'wcd-table', 'class': 'table' });
        var thStyle        = '';

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

        var lastUpdatedElem = E('p', { 'style': 'font-style: italic; color: #666; margin-top: 15px;' });

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
                tableBody.appendChild(E('tr', {}, [
                    E('td', { 'colspan': '11', 'style': 'padding: 20px; text-align: center; color: #666; border: 1px solid #ddd;' },
                        _('No matching clients found.'))
                ]));
                return;
            }

            filteredClients.forEach(function(client) {
                var mac       = client.mac          || 'N/A';
                var ip        = client.ip           || '';
                var hostname  = client.hostname     || '';
                var ssid      = client.ssid         || 'N/A';
                var wifiVer   = client.wifi_ver     || '';
                var band      = client.band         || 'N/A';
                var signal    = client.signal       || 'N/A';
                var rxRate    = client.rx_rate      || 'N/A';
                var txRate    = client.tx_rate      || 'N/A';
                var totalData = client.total_data   || 0;
                var connTime  = client.conn_time    || 0;
                var ap        = client.ap           || 'N/A';

                var signalClass = getSignalClass(signal);
                var signalColor = signalClass === 'signal-strong' ? '#28a745'
                                : signalClass === 'signal-medium' ? '#ffc107'
                                : '#dc3545';
                var bandColor    = band === '5G' ? '#6f42c1' : '#17a2b8';
                var wifiVerColor = getWifiVerColor(wifiVer);

                function td(label, content, extraStyle) {
                    var cell = E('td', { 'data-label': label, 'style': extraStyle || '' });
                    if (typeof content === 'string' || typeof content === 'number') {
                        cell.textContent = content;
                    } else {
                        cell.appendChild(content);
                    }
                    return cell;
                }

                function badge(text, color) {
                    return E('span', {
                        'style': 'display:inline-block; padding:3px 8px; font-size:12px; font-weight:bold; background:' + color + '; color:white; border-radius:4px;'
                    }, text);
                }

                var row = E('tr', {});

                row.appendChild(td('IP Address',      ip,                          'font-family:monospace; font-size:0.92em;'));
                row.appendChild(td('Hostname',        hostname,                    'font-weight:500;'));
                row.appendChild(td('Station',         mac,                         'font-family:monospace; font-size:0.92em;'));
                row.appendChild(td('SSID',            ssid));
                row.appendChild(td('WiFi',            badge(wifiVer, wifiVerColor)));
                row.appendChild(td('Band',            badge(band, bandColor)));
                row.appendChild(td('Signal',          signal,                      'color:' + signalColor + ';'));
                row.appendChild(td('RX / TX Rate',    rxRate + ' / ' + txRate));
                row.appendChild(td('Total Data',      formatBytes(totalData)));
                row.appendChild(td('Connected Time',  formatUptime(connTime)));
                row.appendChild(td('AP',              ap,                          'font-weight:500;'));

                tableBody.appendChild(row);
            });
        };

        filterInput.addEventListener('input', function() { populateTable(clients); });

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

        return E('div', { 'class': 'cbi-map' }, [
            E('h2', {}, [ _('Wireless Clients Dashboard'), clientCountElem ]),
            filterInput,
            tableContainer,
            lastUpdatedElem
        ]);
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
