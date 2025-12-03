document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & DATA STORAGE ---
    
    // Augment IDs from id.json (Critical for logic checks)
    const AUGMENT_TECHNICIAN = "23";      // Technician augment ID
    const AUGMENT_VERSATILE = "61";       // Versatile augment ID (assumed based on context)
    const AUGMENT_EXPERIMENTAL = "17";    // Experimental augment ID
    const AUGMENT_NEURO_HACKER = "51";    // Neuro-hacker augment ID (assumed based on context)
    
    // Devices with special Neuro-hacker requirement (match by name)
    const NEURO_HACKER_DEVICE_NAMES = ["Cascade", "Lockdown", "Pathogen"]; 
    
    // Weapon slots (match by string from weapons.json)
    const SLOT_BACKUP = "Backup";
    const SLOT_SIDEARM = "Sidearm"; 
    const SLOT_PRIMARY = "Primary";
    const SLOT_HEAVY = "Heavy"; 

    // Lists of element IDs for easy iteration
    const AUGMENT_SELECTS = ['augment-1-select', 'augment-2-select', 'augment-3-select', 'augment-4-select'];
    const DEVICE_SELECTS = ['device-1-select', 'device-2-select'];
    const WEAPON_SELECTS = ['backup-weapon-select', 'secondary-weapon-select', 'primary-weapon-select'];
    
    const SECONDARY_MOD_SELECTS = ['secondary-mod-1-select', 'secondary-mod-2-select', 'secondary-mod-3-select', 'secondary-mod-4-select'];
    const PRIMARY_MOD_SELECTS = ['primary-mod-1-select', 'primary-mod-2-select', 'primary-mod-3-select', 'primary-mod-4-select'];

    // Global data stores (parsed and indexed from JSON files)
    let allData = {
        augments: {}, // name: id
        devices: {},  // name: full object
        weapons: {},  // name: full object
        attachments: {}, // name: full object
    };
    
    // Global state to hold currently selected items
    let loadoutState = {
        augments: [],
        devices: [],
        weapons: { 
            backup: "",
            secondary: "", 
            primary: "",
        },
        modsSecondary: [],
        modsPrimary: [],
        isTechnician: false,
        isVersatile: false,
        isExperimental: false,
        isNeuroHacker: false,
    };

    // --- UTILITY FUNCTIONS ---
    
    // Helper function to get selected values from a list of select element IDs
    const getValues = (ids) => ids.map(id => document.getElementById(id)?.value).filter(val => val);

    // Generic function to populate a select box with a simple key-value map (used for static lists like Shells/Augments)
    function populateSelect(selectId, dataMap) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;
        selectElement.innerHTML = '<option value="">Select...</option>';
        Object.keys(dataMap).forEach(key => {
            const option = document.createElement('option');
            // DataMap is usually Name: ID for Augments/Shells
            option.value = dataMap[key]; 
            option.textContent = key;
            selectElement.appendChild(option);
        });
    }

    /**
     * Core function to populate select elements, applying filtering and disabling logic.
     * @param {string} selectId - The ID of the <select> element.
     * @param {Object} dataMap - Map of item name to item object (e.g., allData.weapons).
     * @param {Object} restrictions - Object with shouldFilter and shouldDisable functions.
     */
    function populateSelectWithRestrictions(selectId, dataMap, restrictions) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;

        const currentSelection = selectElement.value;
        selectElement.innerHTML = '';
        
        const emptyOption = document.createElement('option');
        emptyOption.value = "";
        emptyOption.textContent = "Select...";
        selectElement.appendChild(emptyOption);
        
        let foundCurrent = false;

        Object.keys(dataMap).forEach(itemName => {
            const item = dataMap[itemName];
            
            // 1. Check if the item should be filtered (removed from the list entirely)
            if (restrictions.shouldFilter(item, selectId)) {
                return; 
            }

            // 2. Create the option element
            const option = document.createElement('option');
            option.value = itemName; // Use name as value
            option.textContent = item.name;

            // 3. Check if the item should be disabled (grayed out)
            if (restrictions.shouldDisable(item)) {
                option.disabled = true;
                // Add class or attribute for custom CSS (already handled by :disabled selector in CSS)
            }
            
            // Re-select the previously selected value
            if (itemName === currentSelection) {
                option.selected = true;
                foundCurrent = true;
            }
            
            selectElement.appendChild(option);
        });
        
        // If the previously selected item is now filtered out or disabled, clear the selection
        if (currentSelection && (!foundCurrent || (selectElement.value !== currentSelection))) {
            selectElement.value = "";
            selectElement.dispatchEvent(new Event('change')); // Trigger change to update other dependent selects
        }
    }

    // --- DATA FETCHING & PROCESSING ---
    
    async function loadAllData() {
        try {
            // Fetch all JSON files concurrently
            const [idRes, devicesRes, weaponsRes, attachmentsRes] = await Promise.all([
                fetch('id.json'),
                fetch('devices.json'),
                fetch('weapons.json'),
                fetch('attachments.json')
            ]);
            
            // Wait for all responses to be parsed as JSON
            const idJson = await idRes.json();
            const devicesJson = await devicesRes.json();
            const weaponsJson = await weaponsRes.json();
            const attachmentsJson = await attachmentsRes.json();

            // Helper to map array of objects to object map by 'name'
            const createNameMap = (data) => {
                const map = {};
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        map[item.name] = item;
                    });
                }
                return map;
            };

            // Store parsed and indexed data
            allData.augments = idJson.Augments || {};
            allData.devices = createNameMap(devicesJson);
            allData.weapons = createNameMap(weaponsJson);
            allData.attachments = createNameMap(attachmentsJson);
            
            // Initial population of static lists (Shells, Augments)
            // The remaining lists (weapons, devices, mods, ammo) must be populated 
            // by handleLoadoutChange to apply filters and restrictions.
            populateSelect('shell-select', idJson.Shells || {});
            AUGMENT_SELECTS.forEach(id => populateSelect(id, idJson.Augments || {}));

        } catch (e) {
            console.error("Failed to load loadout data from JSON files. Ensure files are accessible.", e);
        }
    }
    
    // --- POPULATION & RESTRICTION LOGIC IMPLEMENTATION ---
    
    // Helper function to update the global loadout state based on current selections
    function updateLoadoutState() {
        // Augment Checks
        loadoutState.augments = getValues(AUGMENT_SELECTS);
        loadoutState.isTechnician = loadoutState.augments.includes(AUGMENT_TECHNICIAN);
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isExperimental = loadoutState.augments.includes(AUGMENT_EXPERIMENTAL);
        loadoutState.isNeuroHacker = loadoutState.augments.includes(AUGMENT_NEURO_HACKER);
        
        // Weapon Selections
        loadoutState.weapons.backup = document.getElementById('backup-weapon-select')?.value || "";
        loadoutState.weapons.secondary = document.getElementById('secondary-weapon-select')?.value || "";
        loadoutState.weapons.primary = document.getElementById('primary-weapon-select')?.value || "";
        
        // Device Selections
        loadoutState.devices = getValues(DEVICE_SELECTS);
    }

    /**
     * Logic for Device Selection Restrictions.
     * Implements: Experimental (grayed out if Experimental augment missing)
     * Cascade/Lockdown/Pathogen (grayed out if Neuro-hacker augment missing)
     */
    function populateDeviceSelects() {
        const isExperimentalEquipped = loadoutState.isExperimental;
        const isNeuroHackerEquipped = loadoutState.isNeuroHacker;
        const allDevices = allData.devices;

        DEVICE_SELECTS.forEach(selectId => {            
            populateSelectWithRestrictions(selectId, allDevices, {
                // No filtering logic for devices (all are shown in the list)
                shouldFilter: (device) => false, 
                
                // Disabling/Graying Out Logic
                shouldDisable: (device) => {
                    const isExperimental = device.experimental === "true"; // From devices.json
                    const isNeuroHackerDevice = NEURO_HACKER_DEVICE_NAMES.includes(device.name);
                    
                    // 1. Experimental device requires Experimental augment
                    if (isExperimental && !isExperimentalEquipped) {
                        return true; 
                    }
                    
                    // 2. Neuro-hacker device (Cascade, Lockdown, Pathogen) requires Neuro-hacker augment
                    if (isNeuroHackerDevice && !isNeuroHackerEquipped) {
                        return true;
                    }
                    
                    return false;
                }
            });
        });
    }

    /**
     * Logic for Weapon Selection Restrictions.
     * Implements: Slot matching (Primary only in Primary slot, Sidearm only in Secondary slot)
     * Versatile augment (ignores slot restriction, except for Heavy weapons)
     * Heavy weapon check (always restricted to Backup slot)
     */
    function populateWeaponSelects() {
        const isVersatileEquipped = loadoutState.isVersatile;
        const allWeapons = allData.weapons;
        
        WEAPON_SELECTS.forEach(selectId => {
            
            let expectedWeaponSlot;
            // Map the HTML select ID to the expected slot name in weapons.json
            if (selectId === 'backup-weapon-select') expectedWeaponSlot = SLOT_BACKUP;
            else if (selectId === 'secondary-weapon-select') expectedWeaponSlot = SLOT_SIDEARM; // Note: 'Sidearm' in weapons.json corresponds to the Secondary select
            else if (selectId === 'primary-weapon-select') expectedWeaponSlot = SLOT_PRIMARY;
            else return;
            
            populateSelectWithRestrictions(selectId, allWeapons, {
                // Filtering Logic (do not show incompatible weapons - the core request)
                shouldFilter: (weapon) => {
                    const weaponSlot = weapon.stats.slot; // Slot from weapons.json
                    const isHeavyWeapon = weaponSlot === SLOT_HEAVY;

                    // 1. Heavy weapons are ALWAYS restricted to the Backup slot
                    if (isHeavyWeapon) {
                        // If current select is NOT the backup slot, filter it out
                        return expectedWeaponSlot !== SLOT_BACKUP; 
                    } 
                    
                    // 2. If Versatile is equipped, ignore all other slot restrictions
                    if (isVersatileEquipped) {
                        return false; // Show non-Heavy weapons everywhere
                    }
                    
                    // 3. If Versatile is NOT equipped, enforce strict slot matching
                    if (weaponSlot !== expectedWeaponSlot) {
                        return true; // Filter out if the weapon's slot doesn't match the select's expected slot
                    }
                    
                    // If we reached here, it's a strict slot match and Versatile is off.
                    return false; 
                },
                
                // No gray-out logic for weapons (they are either shown or filtered)
                shouldDisable: (weapon) => false,
            });
        });
    }
    
    /**
     * Logic for Attachment Restrictions.
     * Implements: Compatibility filtering (only show if compatible with selected weapon)
     * Technician augment (Technician ammo types are grayed out if augment missing)
     */
    function populateAttachmentSelects(weaponSelectId) {
        let weaponName;
        let ammoSelectId;
        let opticSelectId;
        let modSelectIds;
        
        // Map select IDs to the currently selected weapon and attachment slots
        if (weaponSelectId === 'secondary-weapon-select') {
            weaponName = loadoutState.weapons.secondary;
            ammoSelectId = 'secondary-ammo-select';
            opticSelectId = 'secondary-optic-select';
            modSelectIds = SECONDARY_MOD_SELECTS;
        } else if (weaponSelectId === 'primary-weapon-select') {
            weaponName = loadoutState.weapons.primary;
            ammoSelectId = 'primary-ammo-select';
            opticSelectId = 'primary-optic-select';
            modSelectIds = PRIMARY_MOD_SELECTS;
        } else {
            return;
        }
        
        const isTechnicianEquipped = loadoutState.isTechnician;
        const allAttachments = allData.attachments;
        
        const attachmentRestrictions = (type) => ({
            shouldFilter: (attachment) => {
                // 1. Filter by Attachment Type (Ammo, Mod, Optic)
                if (attachment.type !== type) return true;
                
                // 2. Filter by Compatibility
                // If a weapon is selected AND the attachment is not compatible, filter it out
                if (weaponName && !attachment.compatibility.includes(weaponName)) { 
                    return true;
                }
                // If no weapon is selected, show all attachments of this type.
                return false;
            },
            
            shouldDisable: (attachment) => {
                // Gray-out logic only applies to Ammo type
                if (attachment.type === 'Ammo') {
                    const isTechnicianAmmo = attachment.technician === "true"; // From attachments.json
                    
                    // Technician ammo (e.g., CB Ammo, Chem Ammo) should be grayed out if Technician augment is NOT equipped
                    if (isTechnicianAmmo && !isTechnicianEquipped) {
                        return true;
                    }
                }
                return false;
            }
        });
        
        // Apply restrictions to all relevant attachment selectors
        
        // Ammo
        populateSelectWithRestrictions(ammoSelectId, allAttachments, attachmentRestrictions('Ammo'));
        
        // Optic
        populateSelectWithRestrictions(opticSelectId, allAttachments, attachmentRestrictions('Optic'));

        // Mods (Iterate over all mod slots)
        modSelectIds.forEach(selectId => {
            populateSelectWithRestrictions(selectId, allAttachments, attachmentRestrictions('Mod'));
        });
    }

    // --- MAIN EVENT HANDLER ---
    
    function handleLoadoutChange() {
        // 1. Update the state based on the current selections
        updateLoadoutState();
        
        // 2. Re-populate/Filter/Disable all select boxes based on the new state
        
        // A. Weapon Slot logic
        populateWeaponSelects(); 
        
        // B. Device logic
        populateDeviceSelects();

        // C. Attachment logic (depends on selected weapons)
        populateAttachmentSelects('secondary-weapon-select');
        populateAttachmentSelects('primary-weapon-select');
        
        // Re-run loadout state update to capture changes from filtering/clearing the selections
        updateLoadoutState();

        // (Original script uniqueness/tooltip logic would go here)
    }
    
    // --- INITIALIZATION ---

    async function init() {
        await loadAllData(); // Load and index all JSON data
        
        // --- Add Event Listeners ---
        const allSelects = document.querySelectorAll('.container select');
        allSelects.forEach(select => {
            select.addEventListener('change', handleLoadoutChange);
        });

        // Run once on startup to ensure initial state and restrictions are applied
        handleLoadoutChange(); 
    }

    init();
});