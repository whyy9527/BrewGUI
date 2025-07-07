import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:3001/api';

interface Package {
    name: string;
    desc: string;
    category: string;
    isDependent: boolean;
    isOutdated?: boolean; // Added for update feature
}

interface Packages {
    formulae: Package[];
    casks: Package[];
}

interface OutdatedPackage {
    name: string;
    current_version: string;
    installed_versions: string[];
    latest_version: string;
    type: 'formula' | 'cask';
}

interface GroupedPackages {
    [key: string]: Package[];
}

interface SearchResultNames {
    formulae: string[];
    casks: string[];
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
    const [outdatedPackages, setOutdatedPackages] = useState<OutdatedPackage[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalContent, setModalContent] = useState<string | null>(null);
    const [filterByDependency, setFilterByDependency] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'installed' | 'install' | 'updates'>('installed');

    // For Install Tab
    const [installSearchTerm, setInstallSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResultNames | null>(null);
    const [searching, setSearching] = useState<boolean>(false);
    const [installing, setInstalling] = useState<string | null>(null);

    // For Updates Tab
    const [updatingAll, setUpdatingAll] = useState<boolean>(false);
    const [updatingSingle, setUpdatingSingle] = useState<string | null>(null);

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

    const fetchOutdatedPackages = async () => {
        try {
            const response = await axios.get<{ formulae: OutdatedPackage[]; casks: OutdatedPackage[] }>(`${API_BASE_URL}/outdated`);
            setOutdatedPackages([...response.data.formulae, ...response.data.casks]);
        } catch (err) {
            console.error("Failed to fetch outdated packages:", err);
            setOutdatedPackages([]);
        }
    };

    useEffect(() => {
        fetchPackages();
        fetchOutdatedPackages();
    }, []);

    const handleUninstall = async (type: 'formulae' | 'casks', name: string) => {
        if (!window.confirm(`Are you sure you want to uninstall ${name}?`)) return;
        setUninstalling(name);
        try {
            await axios.delete(`${API_BASE_URL}/uninstall/${type}/${name}`);
            fetchPackages();
            fetchOutdatedPackages(); // Refresh outdated list as well
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
                                <span className="package-name">{pkg.name} {pkg.isOutdated && <span className="outdated-tag">Outdated</span>}</span>
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

    const searchForInstallPackages = useCallback(async () => {
        if (!installSearchTerm) {
            setSearchResults(null);
            setSearching(false);
            return;
        }
        setSearching(true);
        try {
            const response = await axios.get<SearchResultNames>(`${API_BASE_URL}/search?query=${installSearchTerm}`);
            setSearchResults(response.data);
        } catch (err) {
            alert('Failed to search packages.');
            console.error(err);
        }
        setSearching(false);
    }, [installSearchTerm]);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            searchForInstallPackages();
        }, 500); // 500ms debounce time

        return () => {
            clearTimeout(handler);
        };
    }, [installSearchTerm, searchForInstallPackages]);

    const handleInstall = async (type: 'formulae' | 'casks', name: string) => {
        if (!window.confirm(`Are you sure you want to install ${name}?`)) return;
        setInstalling(name);
        try {
            await axios.post(`${API_BASE_URL}/install/${type}/${name}`);
            alert(`Successfully installed ${name}.`);
            fetchPackages(); // Refresh installed packages list
            setSearchResults(null); // Clear search results
            setInstallSearchTerm(''); // Clear search term
            setActiveTab('installed'); // Switch back to installed tab
        } catch (err) {
            alert(`Failed to install ${name}.`);
            console.error(err);
        }
        setInstalling(null);
    };

    const handleUpdateAll = async () => {
        if (!window.confirm('Are you sure you want to update all outdated packages?')) return;
        setUpdatingAll(true);
        try {
            await axios.post(`${API_BASE_URL}/update-all`);
            alert('All outdated packages updated successfully!');
            fetchPackages();
            fetchOutdatedPackages();
        } catch (err) {
            alert('Failed to update all packages.');
            console.error(err);
        }
        setUpdatingAll(false);
    };

    const handleUpdateSingle = async (pkg: OutdatedPackage) => {
        if (!window.confirm(`Are you sure you want to update ${pkg.name}?`)) return;
        setUpdatingSingle(pkg.name);
        try {
            await axios.post(`${API_BASE_URL}/update/${pkg.type === 'formula' ? 'formulae' : 'casks'}/${pkg.name}`);
            alert(`Successfully updated ${pkg.name}.`);
            fetchPackages();
            fetchOutdatedPackages();
        } catch (err) {
            alert(`Failed to update ${pkg.name}.`);
            console.error(err);
        }
        setUpdatingSingle(null);
    };

    return (
        <div className="App">
            {modalContent && <Modal content={modalContent} onClose={() => setModalContent(null)} />}
            <header className="App-header">
                <h1>BrewGUI</h1>
                <p>A simple web interface for Homebrew</p>
                <div className="tabs">
                    <button 
                        className={activeTab === 'installed' ? 'active' : ''}
                        onClick={() => setActiveTab('installed')}
                    >
                        Installed Packages
                    </button>
                    <button 
                        className={activeTab === 'install' ? 'active' : ''}
                        onClick={() => setActiveTab('install')}
                    >
                        Install New Package
                    </button>
                    <button 
                        className={activeTab === 'updates' ? 'active' : ''}
                        onClick={() => {
                            setActiveTab('updates');
                            fetchOutdatedPackages(); // Refresh when tab is clicked
                        }}
                    >
                        Updates ({outdatedPackages.length})
                    </button>
                </div>
            </header>
            <main>
                {activeTab === 'installed' && (
                    <>
                        <div className="filter-controls">
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
                        </div>
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
                    </>
                )}
                {activeTab === 'install' && (
                    <div className="install-tab-content">
                        <div className="search-install-bar">
                            <input 
                                type="text" 
                                placeholder="Search for packages to install..." 
                                value={installSearchTerm}
                                onChange={e => setInstallSearchTerm(e.target.value)}
                            />
                        </div>
                        {searching && <p>Searching...</p>}
                        {searchResults && (searchResults.formulae.length > 0 || searchResults.casks.length > 0) ? (
                            <div className="search-results-container package-container">
                                <div className="package-list">
                                    <h2>Formulae ({searchResults.formulae.length})</h2>
                                    <ul>
                                        {searchResults.formulae.map(pkgName => (
                                            <li key={pkgName}>
                                                <span>{pkgName}</span>
                                                <div className="package-actions">
                                                    <button onClick={() => handleShowInfo('formulae', pkgName)}>Details</button>
                                                    <button 
                                                        onClick={() => handleInstall('formulae', pkgName)}
                                                        disabled={installing === pkgName}
                                                    >
                                                        {installing === pkgName ? 'Installing...' : 'Install'}
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="package-list">
                                    <h2>Casks ({searchResults.casks.length})</h2>
                                    <ul>
                                        {searchResults.casks.map(pkgName => (
                                            <li key={pkgName}>
                                                <span>{pkgName}</span>
                                                <div className="package-actions">
                                                    <button onClick={() => handleShowInfo('casks', pkgName)}>Details</button>
                                                    <button 
                                                        onClick={() => handleInstall('casks', pkgName)}
                                                        disabled={installing === pkgName}
                                                    >
                                                        {installing === pkgName ? 'Installing...' : 'Install'}
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : (installSearchTerm && !searching && <p>No results found.</p>)}
                    </div>
                )}
                {activeTab === 'updates' && (
                    <div className="updates-tab-content">
                        {outdatedPackages.length > 0 ? (
                            <>
                                <button 
                                    onClick={handleUpdateAll}
                                    disabled={updatingAll}
                                    className="update-all-button"
                                >
                                    {updatingAll ? 'Updating All...' : `Update All (${outdatedPackages.length})`}
                                </button>
                                <div className="package-container">
                                    <div className="package-list full-width">
                                        <h2>Outdated Packages</h2>
                                        <ul>
                                            {outdatedPackages.map(pkg => (
                                                <li key={pkg.name}>
                                                    <div className="package-info">
                                                        <span className="package-name">{pkg.name}</span>
                                                        <p className="package-desc">{pkg.current_version} &rarr; {pkg.latest_version}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleUpdateSingle(pkg)}
                                                        disabled={updatingSingle === pkg.name}
                                                    >
                                                        {updatingSingle === pkg.name ? 'Updating...' : 'Update'}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p>All packages are up to date!</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;