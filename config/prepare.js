const fs = require('fs');
const path = require('path');

const distRoot = `${__dirname}/../dist`;

const packageJson = require('../package.json');

packageJson.private = false;

delete packageJson.scripts;
delete packageJson.exports;

const distPackageJson = JSON.stringify(packageJson, null, 2) + '\n';

fs.writeFileSync(`${distRoot}/package.json`, distPackageJson);

const srcDir = `${__dirname}/..`;
const destDir = `${srcDir}/dist`;
fs.copyFileSync(`${srcDir}/README.md`, `${destDir}/README.md`);
fs.copyFileSync(`${srcDir}/LICENSE.md`, `${destDir}/LICENSE.md`);
