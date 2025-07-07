
const express = require('express');
const { exec, spawn } = require('child_process');
const cors = require('cors');

let isBrewCommandRunning = false; // Global lock for brew commands

const app = express();
const port = 3001;

app.use(cors());

// Helper function to run shell commands
const runCommand = (command, isBrewUpgradeCommand = false) => {
    return new Promise((resolve, reject) => {
        const [cmd, ...args] = command.split(' ');
        const child = spawn(cmd, args, { maxBuffer: 1024 * 5000 });

        let stdoutBuffer = '';
        let stderrBuffer = '';

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdoutBuffer += chunk;
            if (isBrewUpgradeCommand) {
                process.stdout.write(chunk); // Real-time output to server terminal
            }
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderrBuffer += chunk;
            if (isBrewUpgradeCommand) {
                process.stderr.write(chunk); // Real-time error output to server terminal
            }
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject({ error: `Command exited with code ${code}`, stdout: stdoutBuffer.trim(), stderr: stderrBuffer.trim() });
            } else {
                resolve({ stdout: stdoutBuffer.trim(), stderr: stderrBuffer.trim() });
            }
        });

        child.on('error', (err) => {
            reject({ error: `Failed to start command: ${err.message}`, stdout: stdoutBuffer.trim(), stderr: stderrBuffer.trim() });
        });
    });
};

// Function to run brew commands with a lock
const runBrewCommand = (command) => {
    return new Promise(async (resolve, reject) => {
        if (isBrewCommandRunning) {
            return reject({ error: 'A brew command is already running. Please wait.' });
        }
        isBrewCommandRunning = true;
        try {
            const isUpgradeCommand = command.startsWith('brew upgrade');
            const { stdout, stderr } = await runCommand(command, isUpgradeCommand);

            if (isUpgradeCommand) {
                console.log(`Brew upgrade command finished. Final output:`);
                if (stdout) {
                    console.log(`Command stdout:\n${stdout}`);
                }
                if (stderr) {
                    console.error(`Command stderr:\n${stderr}`);
                }
            }
            resolve(stdout);
        } catch (e) {
            const isUpgradeCommand = command.startsWith('brew upgrade');
            if (isUpgradeCommand) {
                console.error(`Error executing brew upgrade command: ${command}`);
                if (e.stdout) {
                    console.log(`Error stdout:\n${e.stdout}`);
                }
                if (e.stderr) {
                    console.error(`Error stderr:\n${e.stderr}`);
                }
            }
            reject(e);
        } finally {
            isBrewCommandRunning = false;
        }
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
        const { stdout: jsonOutput } = await runCommand('brew info --json=v2 --installed');
        const brewInfo = JSON.parse(jsonOutput);

        const { stdout: outdatedJson } = await runCommand('brew outdated --json');
        const outdatedInfo = JSON.parse(outdatedJson);
        const outdatedNames = new Set(outdatedInfo.formulae.map(f => f.name).concat(outdatedInfo.casks.map(c => c.name)));

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
            isDependent: dependentPackages.has(pkg.name),
            isOutdated: outdatedNames.has(pkg.name)
        }));

        const casks = brewInfo.casks.map(pkg => ({
            name: pkg.token, // For casks, the command-line name is 'token'
            desc: pkg.desc || 'No description available.',
            category: assignCategory(pkg.desc || ''),
            isDependent: dependentPackages.has(pkg.token),
            isOutdated: outdatedNames.has(pkg.token)
        }));
        
        res.json({ formulae, casks });
    } catch (e) {
        console.error("Error fetching package info:", e);
        res.status(500).json({ error: 'Failed to get package lists.', details: e });
    }
});

// Endpoint to get outdated packages
app.get('/api/outdated', async (req, res) => {
    try {
        const { stdout: outdatedJson } = await runCommand('brew outdated --json');
        const outdatedInfo = JSON.parse(outdatedJson);
        const formulaeOutdated = outdatedInfo.formulae.map(pkg => ({ ...pkg, type: 'formula' }));
        const casksOutdated = outdatedInfo.casks.map(pkg => ({ ...pkg, type: 'cask' }));
        res.json({ formulae: formulaeOutdated, casks: casksOutdated });
    } catch (e) {
        console.error("Error fetching outdated packages:", e);
        res.status(500).json({ error: 'Failed to get outdated packages.', details: e });
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
        const output = await runBrewCommand(command);
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

// Endpoint to search for packages (returns names only)
app.get('/api/search', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Search query is required.' });
    }

    // Basic validation to prevent command injection
    if (!/^[a-zA-Z0-9@._\s-]+$/.test(query)) {
        return res.status(400).json({ error: 'Invalid search query.' });
    }

    try {
        // Search for both formulae and casks to get names
        const formulaeSearchOutput = await runCommand(`brew search --formulae ${query}`);
        const casksSearchOutput = await runCommand(`brew search --casks ${query}`);

        const formulaeNames = formulaeSearchOutput.split(/\s+/).filter(Boolean);
        const casksNames = casksSearchOutput.split(/\s+/).filter(Boolean);

        res.json({ formulae: formulaeNames, casks: casksNames });
    } catch (e) {
        console.error("Error searching packages:", e);
        res.status(500).json({ error: 'Failed to search packages.', details: e });
    }
});

// Endpoint to install a package
app.post('/api/install/:type/:name', async (req, res) => {
    const { type, name } = req.params;
    if (type !== 'formulae' && type !== 'casks') {
        return res.status(400).json({ error: 'Invalid package type.' });
    }

    if (!/^[a-zA-Z0-9@._-]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid package name.' });
    }

    const command = `brew install ${type === 'casks' ? '--cask ' : ''}${name}`;

    try {
        const output = await runBrewCommand(command);
        res.json({ success: true, message: `Successfully installed ${name}.`, output });
    } catch (e) {
        res.status(500).json({ error: `Failed to install ${name}.`, details: e });
    }
});

// Endpoint to update all outdated packages
app.post('/api/update-all', async (req, res) => {
    try {
        const output = await runBrewCommand('brew upgrade');
        res.json({ success: true, message: 'Successfully updated all outdated packages.', output });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update all packages.', details: e });
    }
});

// Endpoint to update a specific package
app.post('/api/update/:type/:name', async (req, res) => {
    const { type, name } = req.params;
    if (type !== 'formulae' && type !== 'casks') {
        return res.status(400).json({ error: 'Invalid package type.' });
    }

    if (!/^[a-zA-Z0-9@._-]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid package name.' });
    }

    const command = `brew upgrade ${type === 'casks' ? '--cask ' : ''}${name}`;

    try {
        const output = await runBrewCommand(command);
        res.json({ success: true, message: `Successfully updated ${name}.`, output });
    } catch (e) {
        res.status(500).json({ error: `Failed to update ${name}.`, details: e });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
