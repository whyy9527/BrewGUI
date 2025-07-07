const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());

// Helper function to run shell commands
const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 5000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return reject({ error, stderr });
            }
            resolve(stdout.trim());
        });
    });
};

// Define categories and their keywords
const categories = {
    'Monitoring & Diagnostics': ['monitor', 'diagnostic', 'system info', 'performance', 'stats', 'log'],
    'Image & Graphics': ['image', 'graphics', 'photo', 'png', 'jpeg', 'svg', 'webp', 'gif', 'editor', 'convert image'],
    'Video & Audio': ['video', 'audio', 'media', 'ffmpeg', 'stream', 'record', 'convert video', 'player'],
    'System Utilities': ['system', 'utility', 'tool', 'manage', 'optimize', 'clean', 'disk', 'file', 'clipboard', 'launcher'],
    'Development Tools': ['dev', 'develop', 'code', 'compiler', 'debugger', 'git', 'cli', 'sdk', 'api', 'framework', 'language', 'build', 'test'],
    'Networking': ['network', 'net', 'proxy', 'vpn', 'dns', 'http', 'ssh', 'ftp', 'transfer', 'download', 'upload'],
    'Text & Document': ['text', 'document', 'markdown', 'pdf', 'editor', 'viewer', 'parser'],
    'Security': ['security', 'encrypt', 'decrypt', 'password', 'hash', 'vpn'],
    'Productivity': ['productivity', 'task', 'todo', 'note', 'calendar', 'automation'],
    'Databases': ['database', 'sql', 'nosql', 'db', 'client'],
    'Virtualization': ['virtual', 'vm', 'container', 'docker', 'kubernetes'],
    'Other': [] // Default category
};

function assignCategory(description) {
    const lowerDesc = description.toLowerCase();
    for (const category in categories) {
        if (category === 'Other') continue; // Skip 'Other' for keyword matching
        for (const keyword of categories[category]) {
            if (lowerDesc.includes(keyword)) {
                return category;
            }
        }
    }
    return 'Other';
}

// Endpoint to get all installed packages with descriptions and categories
app.get('/api/packages', async (req, res) => {
    try {
        const jsonOutput = await runCommand('brew info --json=v2 --installed');
        const brewInfo = JSON.parse(jsonOutput);

        const allInstalledNames = new Set();
        brewInfo.formulae.forEach(pkg => allInstalledNames.add(pkg.name));
        brewInfo.casks.forEach(pkg => allInstalledNames.add(pkg.token));

        const dependentPackages = new Set();

        // Identify formulae that are dependencies of other installed formulae
        brewInfo.formulae.forEach(pkg => {
            if (pkg.dependencies) {
                pkg.dependencies.forEach(dep => {
                    if (allInstalledNames.has(dep)) {
                        dependentPackages.add(dep);
                    }
                });
            }
        });

        // Identify casks that are dependencies of other installed casks (less common, but possible)
        brewInfo.casks.forEach(pkg => {
            if (pkg.depends_on && pkg.depends_on.formula) {
                pkg.depends_on.formula.forEach(dep => {
                    if (allInstalledNames.has(dep)) {
                        dependentPackages.add(dep);
                    }
                });
            }
            if (pkg.depends_on && pkg.depends_on.cask) {
                pkg.depends_on.cask.forEach(dep => {
                    if (allInstalledNames.has(dep)) {
                        dependentPackages.add(dep);
                    }
                });
            }
        });

        const formulae = brewInfo.formulae.map(pkg => ({
            name: pkg.name,
            desc: pkg.desc || 'No description available.',
            category: assignCategory(pkg.desc || ''),
            isDependent: dependentPackages.has(pkg.name)
        }));

        const casks = brewInfo.casks.map(pkg => ({
            name: pkg.token, // For casks, the command-line name is 'token'
            desc: pkg.desc || 'No description available.',
            category: assignCategory(pkg.desc || ''),
            isDependent: dependentPackages.has(pkg.token)
        }));
        
        res.json({ formulae, casks });
    } catch (e) {
        console.error("Error fetching package info:", e);
        res.status(500).json({ error: 'Failed to get package lists.', details: e });
    }
});

// Endpoint to uninstall a package
app.delete('/api/uninstall/:type/:name', async (req, res) => {
    const { type, name } = req.params;
    if (type !== 'formulae' && type !== 'casks') {
        return res.status(400).json({ error: 'Invalid package type.' });
    }

    if (!/^[a-zA-Z0-9@._-]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid package name.' });
    }

    const command = `brew uninstall ${type === 'casks' ? '--cask ' : ''}${name}`;

    try {
        const output = await runCommand(command);
        res.json({ success: true, message: `Successfully uninstalled ${name}.`, output });
    } catch (e) {
        res.status(500).json({ error: `Failed to uninstall ${name}.`, details: e });
    }
});

// Endpoint to get detailed info for a single package
app.get('/api/info/:type/:name', async (req, res) => {
    const { type, name } = req.params;
    if (type !== 'formulae' && type !== 'casks') {
        return res.status(400).json({ error: 'Invalid package type.' });
    }

    if (!/^[a-zA-Z0-9@._-]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid package name.' });
    }

    const command = `brew info ${name}`;

    try {
        const output = await runCommand(command);
        res.json({ info: output });
    } catch (e) {
        res.status(500).json({ error: `Failed to get info for ${name}.`, details: e });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});