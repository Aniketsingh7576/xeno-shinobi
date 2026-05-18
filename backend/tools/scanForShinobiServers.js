const net = require('net');
const os = require('os');

// Function to check if a port is open on a given IP
async function checkPort(ip, port, timeout = 1000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let status = 'closed';

        socket.setTimeout(timeout);
        socket.on('connect', () => {
            status = 'open';
            socket.destroy();
            resolve(status);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(status);
        });

        socket.on('error', () => {
            socket.destroy();
            resolve(status);
        });

        socket.connect(port, ip);
    });
}

// Function to get all local network interfaces
function getLocalIPRanges() {
    const interfaces = os.networkInterfaces();
    const ranges = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (iface.internal || iface.family !== 'IPv4') continue;

            // Get network range (simple /24 assumption)
            const ipParts = iface.address.split('.').slice(0, 3);
            ranges.push(ipParts.join('.') + '.0/24');
        }
    }

    return ranges;
}

// Function to generate all IPs in a range
function* generateIPsFromRange(ipRange) {
    const [base, mask] = ipRange.split('/');
    const baseParts = base.split('.').map(Number);

    // Simple handling for /24 ranges
    if (mask === '24') {
        for (let i = 1; i <= 254; i++) {
            yield `${baseParts[0]}.${baseParts[1]}.${baseParts[2]}.${i}`;
        }
    }
}

// Main scanning function
async function scanNetwork() {
    const ipRanges = getLocalIPRanges();
    const portsToCheck = [8080, 8005];
    const portNamesToCheck = {"8080": "CORE", "8005": "CENTRAL"};

    console.log(`Starting scan of local network ranges: ${ipRanges.join(', ')}`);
    console.log(`Checking ports: ${portsToCheck.join(', ')}`);

    for (const range of ipRanges) {
        console.log(`\nScanning range: ${range}`);

        for (const ip of generateIPsFromRange(range)) {
            for (const port of portsToCheck) {
                checkPort(ip, port).then((status) => {
                    if(status === 'open')console.log(`${ip}, Port: ${port} - ${status}`, portNamesToCheck[port]);
                })
            }
        }
    }
}

// Run the scan
scanNetwork().catch(console.error);
