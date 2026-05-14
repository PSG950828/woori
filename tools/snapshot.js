#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backupRoot = path.join(projectRoot, 'backups');
const timestamp = new Date();
const pad = (value) => String(value).padStart(2, '0');
const folderName = [
    timestamp.getFullYear(),
    pad(timestamp.getMonth() + 1),
    pad(timestamp.getDate())
].join('') + '-' + [
    pad(timestamp.getHours()),
    pad(timestamp.getMinutes()),
    pad(timestamp.getSeconds())
].join('');
const snapshotDir = path.join(backupRoot, folderName);
const uiFiles = [
    'index.html',
    path.join('css', 'styles.css'),
    path.join('js', 'app.js')
];

function ensureDir(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

function copyFile(relativePath) {
    const source = path.join(projectRoot, relativePath);
    if (!fs.existsSync(source)) {
        console.warn(`[snapshot] Skip missing file: ${relativePath}`);
        return false;
    }
    const destination = path.join(snapshotDir, relativePath);
    ensureDir(path.dirname(destination));
    fs.copyFileSync(source, destination);
    return true;
}

function main() {
    ensureDir(backupRoot);
    ensureDir(snapshotDir);
    const copied = uiFiles.filter(copyFile);
    if (!copied.length) {
        console.error('[snapshot] No files were copied.');
        process.exitCode = 1;
        return;
    }
    console.log(`[snapshot] Created ${path.relative(projectRoot, snapshotDir)}`);
    copied.forEach((file) => console.log(`  • ${file}`));
}

main();
