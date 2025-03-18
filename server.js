const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { exec } = require('child_process');

const app = express();
const hostname = '127.0.0.1'; // Change this to 'localhost' or '127.0.0.1'
const port = 8080; // Change this to your desired port

app.use(express.static(path.join(__dirname, 'public')));

app.get('/DS', (req, res) => {
    const workbook = XLSX.readFile('C:\\DS.xlsx');
    const requiredSheets = ['Case Details', 'Open Cases', 'Technical Analysis', 'Defect Cases', 'Pending RCA', 'Resolved', 'No Next Steps', 'Next Steps'];
    const data = {};

    requiredSheets.forEach(sheetName => {
        if (workbook.SheetNames.includes(sheetName)) {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            data[sheetName] = jsonData;
        } else {
            data[sheetName] = `Sheet ${sheetName} not found`;
        }
    });

    res.json(data);
});

app.get('/run-script', (req, res) => {
    const scriptPath = 'C:\\script.js'; // Ensure this path is correct
    runPowerShellScript(scriptPath, (message) => {
        res.send(message);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

function runPowerShellScript(scriptPath, callback) {
    exec(`powershell.exe -File "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            callback(`Error executing script: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Script error: ${stderr}`);
            callback(`Script error: ${stderr}`);
            return;
        }
        console.log(`Script output: ${stdout}`);
        callback(`Script output: ${stdout}`);
    });
}
