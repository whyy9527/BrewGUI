import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:3001/api';

interface Package {
    name: string;
    desc: string;
    category: string;
    isDependent: boolean;
}

interface Packages {
    formulae: Package[];
    casks: Package[];
}

interface GroupedPackages {
    [key: string]: Package[];
}

// Modal component for showing details
const Modal = ({ content, onClose }: { content: string; onClose: () => void }) => (
    <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <pre>{content}</pre>
            <button onClick={onClose} className="modal-close-btn">Close</button>
        </div>
    </div>
);

function App() {
    const [packages, setPackages] = useState<Packages>({ formulae: [], casks: [] });
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalContent, setModalContent] = useState<string | null>(null);
    const [filterByDependency, setFilterByDependency] = useState<boolean>(false);

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const response = await axios.get<Packages>(`${API_BASE_URL}/packages`);
            setPackages(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch packages. Is the server running?');
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const handleUninstall = async (type: 'formulae' | 'casks', name: string) => {
        if (!window.confirm(`Are you sure you want to uninstall ${name}?`)) return;
        setUninstalling(name);
        try {
            await axios.delete(`${API_BASE_URL}/uninstall/${type}/${name}`);
            fetchPackages();
        } catch (err) {
            alert(`Failed to uninstall ${name}.`);
            console.error(err);
        }
        setUninstalling(null);
    };

    const handleShowInfo = async (type: 'formulae' | 'casks', name: string) => {
        setModalContent('Loading details...');
        try {
            const response = await axios.get(`${API_BASE_URL}/info/${type}/${name}`);
            setModalContent(response.data.info);
        } catch (err) {
            setModalContent('Failed to load details.');
        }
    };

    const filteredPackages = useMemo(() => {
        const filter = (pkgs: Package[]) => 
            pkgs.filter(pkg => 
                pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                pkg.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                pkg.category.toLowerCase().includes(searchTerm.toLowerCase())
            );
        return { formulae: filter(packages.formulae), casks: filter(packages.casks) };
    }, [searchTerm, packages]);

    const groupedPackages = (pkgs: Package[]): GroupedPackages => {
        if (filterByDependency) {
            const dependent: Package[] = [];
            const core: Package[] = [];
            pkgs.forEach(pkg => {
                if (pkg.isDependent) {
                    dependent.push(pkg);
                } else {
                    core.push(pkg);
                }
            });
            return {
                'Core Packages': core.sort((a, b) => a.name.localeCompare(b.name)),
                'Dependent Packages': dependent.sort((a, b) => a.name.localeCompare(b.name)),
            };
        } else {
            return pkgs.reduce((acc, pkg) => {
                const category = pkg.category || 'Uncategorized';
                if (!acc[category]) acc[category] = [];
                acc[category].push(pkg);
                return acc;
            }, {} as GroupedPackages);
        }
    };

    const renderPackageList = (pkgs: Package[], type: 'formulae' | 'casks') => {
        const grouped = groupedPackages(pkgs);
        return Object.keys(grouped).sort().map(groupName => (
            <div key={groupName}>
                <h3 className="group-category">{groupName}</h3>
                <ul>
                    {grouped[groupName].map(pkg => (
                        <li key={pkg.name}>
                            <div className="package-info">
                                <span className="package-name">{pkg.name}</span>
                                <p className="package-desc">{pkg.desc}</p>
                            </div>
                            <div className="package-actions">
                                <button onClick={() => handleShowInfo(type, pkg.name)}>Details</button>
                                <button 
                                    onClick={() => handleUninstall(type, pkg.name)}
                                    disabled={uninstalling === pkg.name}
                                    className="uninstall-btn"
                                >
                                    {uninstalling === pkg.name ? '...' : 'Uninstall'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        ));
    };

    return (
        <div className="App">
            {modalContent && <Modal content={modalContent} onClose={() => setModalContent(null)} />}
            <header className="App-header">
                <h1>BrewGUI</h1>
                <p>A simple web interface for Homebrew</p>
                <input 
                    type="text" 
                    placeholder="Search by name, description, or category..." 
                    className="search-bar"
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <button 
                    onClick={() => setFilterByDependency(!filterByDependency)}
                    className="filter-button"
                >
                    {filterByDependency ? 'Show by Category' : 'Group by Dependency'}
                </button>
            </header>
            <main>
                {loading && <p>Loading packages...</p>}
                {error && <p className="error">{error}</p>}
                {!loading && !error && (
                    <div className="package-container">
                        <div className="package-list">
                            <h2>Formulae ({filteredPackages.formulae.length})</h2>
                            {renderPackageList(filteredPackages.formulae, 'formulae')}
                        </div>
                        <div className="package-list">
                            <h2>Casks ({filteredPackages.casks.length})</h2>
                            {renderPackageList(filteredPackages.casks, 'casks')}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;