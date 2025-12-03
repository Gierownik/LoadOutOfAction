document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & AUGMENT IDs ---
    const AUGMENT_TECHNICIAN = "23";      
    const AUGMENT_VERSATILE = "61";       
    const AUGMENT_HEAVY_WEAPONS = "19";   
    const AUGMENT_NEURO_HACKER = "68";    
    const AUGMENT_EXPERIMENTAL = "17";    

    // Lists of element IDs for easy iteration
    const AUGMENT_SELECTS = ['augment-1-select', 'augment-2-select', 'augment-3-select', 'augment-4-select'];
    const DEVICE_SELECTS = ['device-1-select', 'device-2-select'];
    const WEAPON_SELECTS = ['backup-weapon-select', 'secondary-weapon-select', 'primary-weapon-select'];
    
    // All attachment slots (for dynamic filtering)
    const ATTACHMENT_SLOTS = {
        'secondary-ammo-select': { type: 'Ammo', weaponSlot: 'secondary-weapon-select' },
        'primary-ammo-select': { type: 'Ammo', weaponSlot: 'primary-weapon-select' },
        'secondary-optic-select': { type: 'Optic', weaponSlot: 'secondary-weapon-select' },
        'primary-optic-select': { type: 'Optic', weaponSlot: 'primary-weapon-select' },
        'secondary-mod-1-select': { type: 'Mod', weaponSlot: 'secondary-weapon-select' },
        'secondary-mod-2-select': { type: 'Mod', weaponSlot: 'secondary-weapon-select' },
        'secondary-mod-3-select': { type: 'Mod', weaponSlot: 'secondary-weapon-select' },
        'secondary-mod-4-select': { type: 'Mod', weaponSlot: 'secondary-weapon-select' },
        'primary-mod-1-select': { type: 'Mod', weaponSlot: 'primary-weapon-select' },
        'primary-mod-2-select': { type: 'Mod', weaponSlot: 'primary-weapon-select' },
        'primary-mod-3-select': { type: 'Mod', weaponSlot: 'primary-weapon-select' },
        'primary-mod-4-select': { type: 'Mod', weaponSlot: 'primary-weapon-select' }
    };

    let allData = {
        idMap: {}, 
        shells: {},
        augments: {},
        weapons: [],    
        devices: [],    
        attachments: [] 
    };

    let loadoutState = {
        augments: [],
        devices: [],
        weapons: { backup: "", secondary: "", primary: "", all: [] },
        mods: [],
        isTechnician: false,
        isVersatile: false,
        isHeavyWeapons: false,
        isNeuroHacker: false,
        isExperimental: false
    };

    // --- DATA FETCHING & MAPPING ---

    async function fetchLoadoutData() {
        // Ensure these paths are correct for your local environment!
        const ID_URL = 'id.json';
        const WEAPONS_URL = 'weapons.json'; 
        const ATTACHMENTS_URL = 'attachments.json'; 
        const DEVICES_URL = 'devices.json'; 

        try {
            const [idResp, weaponsResp, attachmentsResp, devicesResp] = await Promise.all([
                fetch(ID_URL),
                fetch(WEAPONS_URL),
                fetch(ATTACHMENTS_URL),
                fetch(DEVICES_URL)
            ]);

            // Check for non-200 responses and provide debug info
            const checkResponse = (resp, name) => {
                if (!resp.ok) {
                    throw new Error(`Failed to load ${name} (Status: ${resp.status}). Check the file path and ensure a web server is running for local access.`);
                }
            };
            checkResponse(idResp, ID_URL);
            checkResponse(weaponsResp, WEAPONS_URL);
            checkResponse(attachmentsResp, ATTACHMENTS_URL);
            checkResponse(devicesResp, DEVICES_URL);

            const [idData, weaponsData, attachmentsData, devicesData] = await Promise.all([
                idResp.json(),
                weaponsResp.json(),
                attachmentsResp.json(),
                devicesResp.json()
            ]);
            
            return {
                ...idData, 
                weapons: weaponsData, 
                devices: devicesData, 
                attachments: attachmentsData 
            };
            
        } catch (error) {
            console.error("Critical Error during data loading:", error);
            alert(`Error loading data. See console for details. (Likely file access issue: ${error.message})`);
            return null;
        }
    }

    function mapData(data) {
        // 1. Create a unified Name -> ID map from id.json
        const idMap = {};
        Object.keys(data).forEach(category => {
            if (typeof data[category] === 'object' && !Array.isArray(data[category])) {
                Object.keys(data[category]).forEach(name => {
                    idMap[name] = String(data[category][name]);
                });
            }
        });
        allData.idMap = idMap;
        allData.shells = data.Shells;
        allData.augments = data.Augments;

        // 2. Map external JSON data
        allData.weapons = data.weapons.map(w => ({ 
            ...w, 
            id: idMap[w.name] || w.name, 
            slot: w.stats.slot, 
            name: w.name 
        }));
        
        allData.devices = data.devices.map(d => ({ 
            ...d, 
            id: idMap[d.name] || d.name,
            isExperimental: d.experimental === "true", 
            // Static check for Deadzone (ID 10) based on previous logic, which requires Neuro-Hacker
            isNeuroHackerRequired: (idMap[d.name] === "10") 
        }));

        allData.attachments = data.attachments.map(a => ({ 
            ...a, 
            id: idMap[a.name] || a.name, 
            requiresTechnician: a.technician === "true", 
            compatibility: a.compatibility || [] 
        }));
    }

    // --- UTILITY FUNCTIONS ---

    function populateSelect(selectElementId, dataArray, defaultTextOverride) {
        // ... (function remains the same) ...
        const select = document.getElementById(selectElementId);
        if (!select) return;

        select.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = defaultTextOverride || `-- Select ${selectElementId.split('-')[0]} --`;
        select.appendChild(defaultOption);

        dataArray.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    }

    function updateLoadoutState() {
        const getValues = (ids) => ids.map(id => document.getElementById(id)?.value).filter(val => val);
        
        loadoutState.augments = getValues(AUGMENT_SELECTS);
        loadoutState.devices = getValues(DEVICE_SELECTS);
        
        loadoutState.weapons = {
            backup: document.getElementById('backup-weapon-select')?.value || "",
            secondary: document.getElementById('secondary-weapon-select')?.value || "",
            primary: document.getElementById('primary-weapon-select')?.value || "",
            all: getValues(WEAPON_SELECTS)
        };
        
        // Collect ALL selected mod IDs for uniqueness checks across a single weapon
        const primaryMods = PRIMARY_MOD_SELECTS.map(id => document.getElementById(id)?.value).filter(val => val);
        const secondaryMods = SECONDARY_MOD_SELECTS.map(id => document.getElementById(id)?.value).filter(val => val);
        loadoutState.mods = { primary: primaryMods, secondary: secondaryMods };

        loadoutState.isTechnician = loadoutState.augments.includes(AUGMENT_TECHNICIAN);
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isHeavyWeapons = loadoutState.augments.includes(AUGMENT_HEAVY_WEAPONS);
        loadoutState.isNeuroHacker = loadoutState.augments.includes(AUGMENT_NEURO_HACKER);
        loadoutState.isExperimental = loadoutState.augments.includes(AUGMENT_EXPERIMENTAL);
    }
    
    // --- RESTRICTION LOGIC ---

    function applyAugmentRestrictions() {
        // FIX: Ensure Augments are unique.
        const selectedAugments = loadoutState.augments;
        const allAugmentIds = Object.keys(allData.augments).map(name => allData.idMap[name]);

        AUGMENT_SELECTS.forEach(currentSelectId => {
            const currentSelect = document.getElementById(currentSelectId);
            const currentValue = currentSelect.value;
            
            Array.from(currentSelect.options).forEach(option => {
                const id = option.value;
                if (id === currentValue || id === "") {
                    option.disabled = false;
                    return;
                }
                
                // Disable if selected in another slot
                const selectedCount = selectedAugments.filter(val => val === id).length;
                option.disabled = selectedCount > 0;
            });
        });
    }

    function applyWeaponRestrictions() {
        const selectedWeaponNames = loadoutState.weapons.all.map(id => allData.weapons.find(w => w.id === id)?.name).filter(n => n);

        WEAPON_SELECTS.forEach(selectId => {
            const currentSelect = document.getElementById(selectId);
            const currentValue = currentSelect.value;
            
            let targetSlot = "";
            if (selectId.includes('backup')) {
                targetSlot = loadoutState.isHeavyWeapons ? "Heavy" : "Backup";
            } else if (selectId.includes('primary')) {
                targetSlot = "Primary";
            } else if (selectId.includes('secondary')) {
                targetSlot = "Secondary";
            }

            let allowedWeapons = allData.weapons.filter(weapon => {
                const weaponSlot = weapon.slot;
                
                if (weaponSlot === "Heavy") {
                    return targetSlot === "Heavy" && loadoutState.isHeavyWeapons;
                }
                
                if (!loadoutState.isVersatile) {
                    return targetSlot === weaponSlot;
                } 
                
                // Versatile is equipped: allows non-Heavy weapons in any non-Heavy slot (Primary, Secondary, Backup)
                if (loadoutState.isVersatile) {
                    return weaponSlot !== "Heavy" && targetSlot !== "Heavy";
                }
                
                return false;
            });
            
            // Apply Uniqueness: All weapons must be unique (Versatile only affects devices)
            const filteredData = allowedWeapons.filter(weapon => {
                const selectedCount = selectedWeaponNames.filter(name => name === weapon.name).length;
                return weapon.id === currentValue || selectedCount === 0;
            });
            
            populateSelect(selectId, filteredData);
        });
    }

    function applyDeviceRestrictions() {
        // FIX: Device uniqueness check.
        
        let allowedDevices = allData.devices.filter(device => {
            let isAvailable = true;

            // Check for Neuro-hacker required devices (Deadzone)
            if (device.isNeuroHackerRequired) {
                 if (!loadoutState.isNeuroHacker) isAvailable = false;
            }
            
            // Check for Experimental required devices
            if (device.isExperimental) {
                if (!loadoutState.isExperimental) isAvailable = false;
            }
            
            return isAvailable;
        });

        // Apply uniqueness check: Versatile allows duplicates, otherwise unique.
        const isUnique = !loadoutState.isVersatile;
        DEVICE_SELECTS.forEach(id => {
            const currentSelect = document.getElementById(id);
            const currentValue = currentSelect.value;
            
            const filteredData = allowedDevices.filter(device => {
                if (isUnique) {
                    // Check if selected in OTHER slots
                    const isSelected = loadoutState.devices.includes(device.id) && device.id !== currentValue;
                    return !isSelected;
                }
                return true;
            });
            populateSelect(id, filteredData);
        });
    }

    function applyAttachmentRestrictions() {
        
        for (const [selectId, { type, weaponSlot }] of Object.entries(ATTACHMENT_SLOTS)) {
            const currentSelect = document.getElementById(selectId);
            const selectedWeaponId = document.getElementById(weaponSlot)?.value;
            const selectedWeaponName = allData.weapons.find(w => w.id === selectedWeaponId)?.name;
            
            let allowedAttachments = allData.attachments.filter(att => att.type === type);

            allowedAttachments = allowedAttachments.filter(att => {
                // Compatibility check: Only show attachments compatible with the selected weapon.
                if (!selectedWeaponName) return false;
                if (att.compatibility && !att.compatibility.includes(selectedWeaponName)) {
                    return false;
                }
                
                // Technician check: Require Technician augment if attachment needs it.
                if (att.requiresTechnician && !loadoutState.isTechnician) {
                    return false;
                }
                
                return true;
            });
            
            // Apply Mod uniqueness (Mods must be unique across the same weapon)
            if (type === 'Mod') {
                const weaponPrefix = weaponSlot.split('-')[0]; // 'secondary' or 'primary'
                const selectedModsForWeapon = loadoutState.mods[weaponPrefix];
                
                // The current value should not count against itself
                const otherSelectedMods = selectedModsForWeapon.filter(id => id !== currentSelect.value);

                const filteredData = allowedAttachments.filter(att => {
                    // FIX: Check against otherSelectedMods
                    const isSelected = otherSelectedMods.includes(att.id);
                    
                    // Keep the current selection enabled, and everything else filtered by uniqueness
                    return att.id === currentSelect.value || !isSelected;
                });
                populateSelect(selectId, filteredData);
            } else {
                populateSelect(selectId, allowedAttachments);
            }
        }
    }

    function updateLabels() {
        const label = document.querySelector('label[for="backup-weapon-select"]');
        if (label) {
            if (loadoutState.isHeavyWeapons) {
                label.textContent = "Heavy (Unmoddable):";
            } else {
                label.textContent = "Backup (Unmoddable):";
            }
        }
    }

    /**
     * Main handler that runs on any loadout change.
     */
    function handleLoadoutChange() {
        updateLoadoutState();
        
        // 1. Apply augment uniqueness (Highest priority fix)
        applyAugmentRestrictions(); 
        
        // 2. Apply complex weapon/device filters
        applyWeaponRestrictions(); 
        applyDeviceRestrictions();
        
        // 3. Update labels (must run before attachments)
        updateLabels();
        
        // 4. Apply attachments (depends on current weapon/augment state)
        applyAttachmentRestrictions();
        
        // Final pass to ensure cascading dependency updates (e.g. if a weapon was cleared)
        updateLoadoutState();
        applyAttachmentRestrictions();
    }

    /**
     * Initial setup and event listeners.
     */
    async function initializeEditor() {
        const rawData = await fetchLoadoutData();
        if (!rawData) return; 
        
        mapData(rawData); 

        // Initial population of static items (Shells, Augments)
        populateSelect('shell-select', Object.keys(allData.shells).map(name => ({ name, id: allData.shells[name] })));
        AUGMENT_SELECTS.forEach(id => populateSelect(id, Object.keys(allData.augments).map(name => ({ name, id: allData.augments[name] }))));

        // --- Add Event Listeners ---
        const allSelects = document.querySelectorAll('.container select');
        allSelects.forEach(select => {
            select.addEventListener('change', handleLoadoutChange);
        });

        // Run once on startup to populate all fields and apply initial restrictions
        handleLoadoutChange();
    }

    initializeEditor();
});