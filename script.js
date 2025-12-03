document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & AUGMENT IDs ---
    const AUGMENT_TECHNICIAN = "23";      // Compatibility based on attachment's "technician" property
    const AUGMENT_VERSATILE = "61";       // Allows cross-slot availability for non-heavy weapons/duplicate devices
    const AUGMENT_HEAVY_WEAPONS = "19";   // Changes Backup label, controls access to Heavy slot weapons
    const AUGMENT_NEURO_HACKER = "68";    // Controls access to static "Neuro-hacker" devices
    const AUGMENT_EXPERIMENTAL = "17";    // Controls access to devices with "experimental: true"

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
        idMap: {}, // Name to ID map for uniqueness and augment checks
        shells: {},
        augments: {},
        weapons: [],    // Array of objects from weapons.json
        devices: [],    // Array of objects from devices.json
        attachments: [] // Array of objects from attachments.json
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

    // --- MOCK DATA (REPLACE WITH REAL FETCHES) ---

    // This function simulates fetching and merging all your JSON files.
    // NOTE: You MUST replace this with four actual fetch calls and a data merger
    // when deploying to read from your files.
    async function fetchLoadoutData() {
        console.warn("Using MOCK DATA. You must replace this function with actual fetch calls for weapons.json, attachments.json, and devices.json.");
        
        // 1. Fetching base IDs from id.json (required for Augment/Shell/ID lookups)
        const idResponse = await fetch('id.json');
        const idData = await idResponse.json();
        
        // 2. MOCK DATA for Weapons, Devices, Attachments (based on user structure)
        const mockWeapons = [
            { name: "Warrant", stats: { slot: "Primary" } },
            { name: "Blackout", stats: { slot: "Heavy" } },
            { name: "Akanami", stats: { slot: "Backup" } },
            { name: "Dusters", stats: { slot: "Backup" } },
            { name: "Fists", stats: { slot: "Backup" } },
            { name: "TTK", stats: { slot: "Secondary" } },
            { name: "Umibozu", stats: { slot: "Heavy" } },
            { name: "Major", stats: { slot: "Secondary" } },
            { name: "Nexus", stats: { slot: "Primary" } },
            { name: "Hole-Punch", stats: { slot: "Heavy" } },
            { name: "Custodian", stats: { slot: "Secondary" } },
            { name: "Deckard", stats: { slot: "Primary" } },
            { name: "Vigil", stats: { slot: "Primary" } },
        ];
        
        const mockDevices = [
            { name: "Cascade", experimental: "true" },
            { name: "Lockdown", experimental: "true" },
            { name: "Pathogen", experimental: "true" },
            { name: "Overcharge", experimental: "false" },
            // Static Neuro-hacker devices (based on previous logic)
            { name: "Deadzone", experimental: "false", requiresNeuroHacker: true },
        ];
        
        const mockAttachments = [
            // Sample Ammo: Technician="false", compatible with Major, Nexus, Warrant
            { name: "Heavy Ammo", type: "Ammo", technician: "false", compatibility: ["Major", "Nexus", "Warrant"] },
            // Sample Ammo: Technician="true", compatible with Major, Nexus
            { name: "Shred Ammo", type: "Ammo", technician: "true", compatibility: ["Major", "Nexus"] },
            // Sample Mod: Technician="false", compatible with Major, Warrant
            { name: "Suppressor", type: "Mod", technician: "false", compatibility: ["Major", "Warrant"] },
            // Sample Mod: Technician="true", compatible with Nexus
            { name: "Speed Loader", type: "Mod", technician: "true", compatibility: ["Nexus"] },
            // Include all Optics from id.json as simple attachments
            ...Object.keys(idData.Optics).map(name => ({ name, type: "Optic", technician: "false", compatibility: Object.keys(idData.Weapons) }))
        ];
        
        // Return merged object containing all data
        return {
            ...idData,
            weapons: mockWeapons,
            devices: mockDevices,
            attachments: mockAttachments
        };
    }

    // --- DATA PROCESSING & MAPPING ---

    function mapData(data) {
        // 1. Create a unified Name -> ID map for easy lookup
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

        // 2. Map JSON data to be usable arrays
        allData.weapons = data.weapons.map(w => ({ 
            ...w, 
            id: idMap[w.name] || w.name, 
            slot: w.stats.slot,
            // Ensure weapon names from weapons.json are used for compatibility checks
            name: w.name 
        }));
        
        // Add ID to devices for uniqueness checks
        allData.devices = data.devices.map(d => ({ 
            ...d, 
            id: idMap[d.name] || d.name,
            isExperimental: d.experimental === "true" 
        }));

        // Add ID to attachments for uniqueness checks
        allData.attachments = data.attachments.map(a => ({ 
            ...a, 
            id: idMap[a.name] || a.name, 
            requiresTechnician: a.technician === "true" 
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
        const getWeaponNameById = (id) => allData.weapons.find(w => w.id === id)?.name || null;
        
        loadoutState.augments = getValues(AUGMENT_SELECTS);
        loadoutState.devices = getValues(DEVICE_SELECTS);
        
        loadoutState.weapons = {
            backup: document.getElementById('backup-weapon-select')?.value || "",
            secondary: document.getElementById('secondary-weapon-select')?.value || "",
            primary: document.getElementById('primary-weapon-select')?.value || "",
            all: getValues(WEAPON_SELECTS)
        };
        
        // Get all mod IDs selected across Primary/Secondary for uniqueness check
        const primaryMods = [];
        PRIMARY_MOD_SELECTS.forEach(id => { const val = document.getElementById(id)?.value; if (val) primaryMods.push(val); });
        const secondaryMods = [];
        SECONDARY_MOD_SELECTS.forEach(id => { const val = document.getElementById(id)?.value; if (val) secondaryMods.push(val); });
        loadoutState.mods = [...primaryMods, ...secondaryMods];

        // Check for augment status
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

                const isSelectedInOtherSlot = allValues.filter(val => val === id).length > 0;
                
                // If the item is already selected once, disable it
                if (isSelectedInOtherSlot) {
                    option.disabled = true;
                } else if (!option.disabled) {
                    // Only re-enable if it's not disabled by availability rules
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
            const currentSlotType = selectId.includes('backup') ? 
                (loadoutState.isHeavyWeapons ? "Heavy" : "Backup") : 
                (selectId.includes('primary') ? "Primary" : "Secondary");

            let allowedWeapons = allData.weapons.filter(weapon => {
                const weaponSlot = weapon.slot;
                
                // Rule: Heavy weapons are ALWAYS locked to the Backup/Heavy slot.
                if (weaponSlot === "Heavy") {
                    return currentSlotType === "Heavy" && loadoutState.isHeavyWeapons;
                }
                
                // Rule: All other weapons are locked to their specific slot, UNLESS Versatile is equipped.
                const isCorrectSlot = (currentSlotType === weaponSlot);
                
                if (loadoutState.isVersatile) {
                    // Versatile: Allows any non-Heavy weapon in any non-Heavy slot (and Backup/Heavy slot)
                    return weaponSlot !== "Heavy";
                } else {
                    // No Versatile: Locked to designated slot.
                    return isCorrectSlot;
                }
            });
            
            // Remove options that are already selected in another slot
            const filteredData = allowedWeapons.filter(weapon => {
                const selectedCount = selectedWeaponNames.filter(name => name === weapon.name).length;
                return weapon.id === currentValue || selectedCount === 0;
            });
            
            // Re-populate the list with only the allowed weapons
            populateSelect(selectId, filteredData);
        });
    }

    function applyDeviceRestrictions() {
        // --- 2. Filter Devices based on Augments and Uniqueness ---
        
        let allowedDevices = allData.devices.filter(device => {
            const deviceName = device.name;
            let isAvailable = true;

            // Static Neuro-hacker check (from previous logic) - must stay
            if (deviceName === "Deadzone") { // Example static device
                if (!loadoutState.isNeuroHacker) isAvailable = false;
            }
            
            // Dynamic Experimental check (new rule)
            if (device.isExperimental) {
                if (!loadoutState.isExperimental) isAvailable = false;
            }
            
            return isAvailable;
        });

        // Apply uniqueness check (conditional on Versatile)
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
                // Compatibility check
                if (selectedWeaponName && att.compatibility && !att.compatibility.includes(selectedWeaponName)) {
                    return false;
                }
                // Technician check
                if (att.requiresTechnician && !loadoutState.isTechnician) {
                    return false;
                }
                return true;
            });
            
            // Apply Mod uniqueness (Ammo and Optic don't need uniqueness across other slots)
            if (type === 'Mod') {
                const filteredData = allowedAttachments.filter(att => {
                    const isSelected = loadoutState.mods.includes(att.id) && att.id !== currentSelect.value;
                    return !isSelected;
                });
                populateSelect(selectId, filteredData);
            } else {
                populateSelect(selectId, allowedAttachments);
            }
        }
    }

    /**
     * Changes slot names based on equipped augments.
     */
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
        
        // This is a strict order of operations: weapons/devices must be filtered
        // before attachments can be filtered based on the selected weapon/augment.
        applyWeaponRestrictions(); 
        applyDeviceRestrictions();
        applyAttachmentRestrictions();
        
        // Final label update
        updateLabels();

        // Must run a second time to catch interdependencies
        // e.g., if a weapon selection was cleared by a filter change,
        // it must re-run to clear the weapon's attachments.
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

        // Initial population of all dynamic slots is handled by the initial run of handleLoadoutChange
        // to ensure immediate filtering.
        
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