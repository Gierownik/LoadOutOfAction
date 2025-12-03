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

    /**
     * Fetches all four JSON files concurrently and merges the data.
     * YOU MUST REPLACE THE PLACEHOLDER URLs BELOW.
     */
    async function fetchLoadoutData() {
        // 🚨 IMPORTANT: Replace these paths with the correct URLs for your files.
        const ID_URL = 'https://github.com/Gierownik/OOA-Database/blob/main/UEparser/id.json'; // This one should remain if it's in the same directory
        const WEAPONS_URL = 'https://github.com/Gierownik/OOA-Database/blob/main/UEparser/weapons.json'; // Example: 'https://raw.githubusercontent.com/user/repo/main/weapons.json'
        const ATTACHMENTS_URL = 'https://github.com/Gierownik/OOA-Database/blob/main/UEparser/attachments.json'; 
        const DEVICES_URL = 'https://github.com/Gierownik/OOA-Database/blob/main/UEparser/devices.json'; 

        try {
            const [idResp, weaponsResp, attachmentsResp, devicesResp] = await Promise.all([
                fetch(ID_URL),
                fetch(WEAPONS_URL),
                fetch(ATTACHMENTS_URL),
                fetch(DEVICES_URL)
            ]);

            // Check for non-200 responses
            if (!idResp.ok || !weaponsResp.ok || !attachmentsResp.ok || !devicesResp.ok) {
                 // Determine which file failed for better debugging
                const failed = [
                    !idResp.ok ? 'id.json' : '', 
                    !weaponsResp.ok ? 'weapons.json' : '', 
                    !attachmentsResp.ok ? 'attachments.json' : '', 
                    !devicesResp.ok ? 'devices.json' : ''
                ].filter(Boolean).join(', ');
                
                throw new Error(`One or more files failed to load: ${failed}. Check paths and CORS settings.`);
            }

            const [idData, weaponsData, attachmentsData, devicesData] = await Promise.all([
                idResp.json(),
                weaponsResp.json(),
                attachmentsResp.json(),
                devicesResp.json()
            ]);
            
            // Merge all data into one object
            return {
                ...idData, // Contains Shells, Augments, Optics, etc.
                weapons: weaponsData, // Array of weapon objects
                devices: devicesData, // Array of device objects
                attachments: attachmentsData // Array of attachment objects
            };
            
        } catch (error) {
            console.error("Error loading loadout data. Please check your file paths and web server status.", error);
            alert("Error loading loadout data. Check the browser console for details.");
            return null;
        }
    }

    /**
     * Maps and processes the combined raw data into the global 'allData' structure.
     */
    function mapData(data) {
        // 1. Create a unified Name -> ID map for easy lookup from id.json
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

        // 2. Map Weapons, Devices, and Attachments using complex properties
        allData.weapons = data.weapons.map(w => ({ 
            ...w, 
            id: idMap[w.name] || w.name, 
            slot: w.stats.slot, // READ from weapons.json
            name: w.name 
        }));
        
        allData.devices = data.devices.map(d => ({ 
            ...d, 
            id: idMap[d.name] || d.name,
            isExperimental: d.experimental === "true" // READ from devices.json
        }));

        allData.attachments = data.attachments.map(a => ({ 
            ...a, 
            id: idMap[a.name] || a.name, 
            requiresTechnician: a.technician === "true", // READ from attachments.json
            compatibility: a.compatibility || [] // READ from attachments.json
        }));
    }

    // --- UTILITY FUNCTIONS ---

    function populateSelect(selectElementId, dataArray, defaultTextOverride) {
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
        
        const primaryMods = [];
        PRIMARY_MOD_SELECTS.forEach(id => { const val = document.getElementById(id)?.value; if (val) primaryMods.push(val); });
        const secondaryMods = [];
        SECONDARY_MOD_SELECTS.forEach(id => { const val = document.getElementById(id)?.value; if (val) secondaryMods.push(val); });
        loadoutState.mods = [...primaryMods, ...secondaryMods];

        loadoutState.isTechnician = loadoutState.augments.includes(AUGMENT_TECHNICIAN);
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isHeavyWeapons = loadoutState.augments.includes(AUGMENT_HEAVY_WEAPONS);
        loadoutState.isNeuroHacker = loadoutState.augments.includes(AUGMENT_NEURO_HACKER);
        loadoutState.isExperimental = loadoutState.augments.includes(AUGMENT_EXPERIMENTAL);
    }
    
    // --- RESTRICTION LOGIC ---

    /**
     * General restriction function for uniqueness checks.
     */
    function applyUniqueness(selectIds, allValues) {
        selectIds.forEach(currentSelectId => {
            const currentSelect = document.getElementById(currentSelectId);
            const currentValue = currentSelect.value;
            
            Array.from(currentSelect.options).forEach(option => {
                const id = option.value;
                if (id === currentValue || id === "") return;

                // Check if this option is selected in ANY other slot of the provided group
                const isSelectedInOtherSlot = allValues.filter(val => val === id).length > 0;
                
                if (isSelectedInOtherSlot) {
                    option.disabled = true;
                } else if (!option.disabled) {
                    // Only re-enable if it's not disabled by availability rules (which runs later)
                    option.disabled = false;
                }
            });
        });
    }

    function applyWeaponRestrictions() {
        // --- 1. Filter Weapons based on Slot, Augment, and Uniqueness ---
        
        const selectedWeaponNames = loadoutState.weapons.all.map(id => allData.weapons.find(w => w.id === id)?.name).filter(n => n);

        WEAPON_SELECTS.forEach(selectId => {
            const currentSelect = document.getElementById(selectId);
            const currentValue = currentSelect.value;
            
            // Determine the slot type based on the element ID and Heavy Weapons augment
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
                
                // Heavy weapons are ALWAYS locked to the Backup/Heavy slot.
                if (weaponSlot === "Heavy") {
                    return targetSlot === "Heavy" && loadoutState.isHeavyWeapons;
                }
                
                // If Versatile is NOT equipped, weapon is locked to its designated slot.
                if (!loadoutState.isVersatile) {
                    return targetSlot === weaponSlot;
                } 
                
                // If Versatile IS equipped, allow non-Heavy weapons in any non-Heavy slot.
                if (loadoutState.isVersatile) {
                    // This rule means if the weapon slot is Primary/Secondary/Backup, it can go in any of the three.
                    return targetSlot !== "Heavy" && weaponSlot !== "Heavy";
                }
                
                return false; // Catch-all safety
            });
            
            // Apply Uniqueness: All weapons must be unique (Versatile only affects devices)
            const filteredData = allowedWeapons.filter(weapon => {
                const selectedCount = selectedWeaponNames.filter(name => name === weapon.name).length;
                // Keep the current selection enabled, otherwise, disable if already selected once
                return weapon.id === currentValue || selectedCount === 0;
            });
            
            populateSelect(selectId, filteredData);
        });
    }

    function applyDeviceRestrictions() {
        // --- 2. Filter Devices based on Augments and Uniqueness ---
        
        let allowedDevices = allData.devices.filter(device => {
            let isAvailable = true;

            // Static Neuro-hacker check (Deadzone) - Example based on previous static logic
            if (device.name === "Deadzone") { 
                if (!loadoutState.isNeuroHacker) isAvailable = false;
            }
            
            // Dynamic Experimental check (new rule)
            if (device.isExperimental) {
                if (!loadoutState.isExperimental) isAvailable = false;
            }
            
            return isAvailable;
        });

        // Apply uniqueness check: conditional on Versatile (only Versatile allows duplicates)
        const isUnique = !loadoutState.isVersatile;
        DEVICE_SELECTS.forEach(id => {
            const filteredData = allowedDevices.filter(device => {
                if (isUnique) {
                    const isSelected = loadoutState.devices.includes(device.id) && device.id !== document.getElementById(id).value;
                    return !isSelected;
                }
                return true;
            });
            populateSelect(id, filteredData);
        });
    }

    function applyAttachmentRestrictions() {
        // --- 3. Filter Attachments (Ammo/Mods/Optics) based on Weapon Compatibility and Technician Augment ---
        
        for (const [selectId, { type, weaponSlot }] of Object.entries(ATTACHMENT_SLOTS)) {
            const currentSelect = document.getElementById(selectId);
            const selectedWeaponId = document.getElementById(weaponSlot)?.value;
            const selectedWeaponName = allData.weapons.find(w => w.id === selectedWeaponId)?.name;
            
            let allowedAttachments = allData.attachments.filter(att => att.type === type);

            allowedAttachments = allowedAttachments.filter(att => {
                // Compatibility check: Only show attachments compatible with the selected weapon.
                // If no weapon is selected, show nothing.
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
                // Get all selected mods for the current weapon (excluding the current slot)
                const currentWeaponModSlots = [
                    'secondary-mod-1-select', 'secondary-mod-2-select', 'secondary-mod-3-select', 'secondary-mod-4-select',
                    'primary-mod-1-select', 'primary-mod-2-select', 'primary-mod-3-select', 'primary-mod-4-select'
                ].filter(id => id.includes(weaponSlot.split('-')[0]) && id !== selectId);
                
                const selectedModsForWeapon = currentWeaponModSlots.map(id => document.getElementById(id)?.value).filter(val => val);

                const filteredData = allowedAttachments.filter(att => {
                    const isSelected = selectedModsForWeapon.includes(att.id);
                    return !isSelected;
                });
                populateSelect(selectId, filteredData);
            } else {
                // Ammo and Optic fields just use the filtered list
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
        
        // Order of operations is crucial: Weapons/Devices filter first, then Attachments.
        applyWeaponRestrictions(); 
        applyDeviceRestrictions();
        applyAttachmentRestrictions();
        
        updateLabels();

        // Run a second time to ensure all interdependencies (cleared selections) are resolved.
        // e.g., if selecting a weapon clears the augment, the weapon list might need re-filtering.
        updateLoadoutState();
        applyWeaponRestrictions();
        applyDeviceRestrictions();
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

        // Initial population of all dynamic slots is handled by the initial run of handleLoadoutChange
        
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