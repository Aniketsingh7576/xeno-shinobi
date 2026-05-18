const onvif = require('node-onvif');

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
    console.error('Usage: node script.js <camera_ip> <username> <password>');
    console.error('Example: node script.js 192.168.1.100 admin password123');
    process.exit(1);
}

const [cameraIp, username, password] = args;

// Create an OnvifDevice object
console.log(`Attempting to connect to camera at ${cameraIp}...`);
const device = new onvif.OnvifDevice({
  xaddr: `http://${cameraIp}:8000/onvif/device_service`, // Common ONVIF endpoint
  user: username,
  pass: password
});

// Initialize the device and set NTP
device.init()
  .then(() => {
    console.log('Device initialized successfully.');
    // console.log(`- Manufacturer: ${device.deviceInformation.Manufacturer}`);
    // console.log(`- Model: ${device.deviceInformation.Model}`);

    // Set NTP to use a public server (like Google's)
    // Parameters: dhcp (false=use manual list), manualNTPhosts
    return device.services.device.setNTP({
      'FromDHCP': true,
      'NTPManual': {'Type': "IPv4", 'IPv4Address': '8.8.8.8'}
    });
  })
  .then(() => {
    console.log('Successfully enabled NTP synchronization on the camera.');
    console.log('NTP server set to: 8.8.8.8');
  })
  .catch((error) => {
    console.error('An error occurred:');
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    console.error(`Message: ${error.message}`);
    process.exit(1);
  });
