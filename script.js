document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & DATA STORAGE ---
    
    // IDs for logic checks (Values come from the id.json file)
    const AUGMENT_TECHNICIAN = "23";      // Unlocks technician-only attachments
    const AUGMENT_VERSATILE = "61";       // Allows duplicate devices, but NOT weapons (new logic)
    const AUGMENT_HEAVY_WEAPONS = "19";   // Renames backup slot and allows heavy weapons
    const AUGMENT_EXPERIMENTAL = "17";    // Required for experimental devices
    const AUGMENT_NEUROHACKER = "68";     // Placeholder ID for Neurohacker (assumed next ID)
    const AUGMENT_PROFESSIONAL = "50"; // replace with actual ID
    const AUGMENT_STUDIED = "76";      // replace with actual ID

    
    // Device Names requiring Neurohacker (since IDs are unavailable)
    const DEVICE_LOCKDOWN_NAME = "Lockdown";
    const DEVICE_CASCADE_NAME = "Cascade";
    const DEVICE_PATHOGEN_NAME = "Pathogen";
    
    let allAmmoData = {};       // Stores all Ammo data fetched from JSON
    let allWeaponsData = {};    // Stores Weapon ID: Name map (from id.json)
    let allDevicesData = [];    // Stores array of device objects (from devices.json)
    let allAttachmentsData = [];// Stores array of attachment objects (from attachments.json)

    // Hardcoded weapon category map (ID to Type)
    // NOTE: This uses placeholder IDs. The complete list of weapon IDs must be present in data.Weapons from id.json.
    const WEAPON_CATEGORIES = {
        "2":"secondary", // Major
"3":"secondary", // Deckard
"7":"primary", // Icarus
"6":"primary", // Master-Key
"5":"secondary", // Cerberus
"9":"primary", // Vigil
"1":"backup", // TTK
"8":"primary", // Custodian
"4":"secondary", // Geist
"10":"primary", // Inhibitor
"11":"primary", // Sentinel
"12":"primary", // Warrant
"13":"primary", // Helix
"14":"primary", // Nexus
"15":"heavy", // Umibozu
"16":"heavy", // Blackout
"17":"backup", // Akanami
"18":"primary", // Typhon
"19":"secondary", // Omen
"20":"heavy", // Hole-Punch
"21":"secondary", // Double-Tap
"22":"backup", // Dusters
"23":"backup" // Fists

    };

    // Lists of element IDs for easy iteration
    const AUGMENT_SELECTS = ['augment-1-select', 'augment-2-select', 'augment-3-select', 'augment-4-select'];
    const DEVICE_SELECTS = ['device-1-select', 'device-2-select'];
    const WEAPON_SELECTS = ['backup-weapon-select', 'secondary-weapon-select', 'primary-weapon-select'];
    
    const SECONDARY_MOD_SELECTS = ['secondary-mod-1-select', 'secondary-mod-2-select', 'secondary-mod-3-select', 'secondary-mod-4-select'];
    const PRIMARY_MOD_SELECTS = ['primary-mod-1-select', 'primary-mod-2-select', 'primary-mod-3-select', 'primary-mod-4-select'];
    
    // Global state to hold currently selected items
    let loadoutState = {
        augments: [],
        devices: [],
        weapons: { 
            backup: "",
            secondary: "", 
            primary: "",
            all: []
        },
        modsSecondary: [],
        modsPrimary: [],
        isTechnician: false,
        isVersatile: false,
        isHeavyWeapons: false,
        isExperimental: false,
        isNeurohacker: false
    };
    
    // --- UTILITY FUNCTIONS ---

    /**
     * Generic function to populate a select element.
     */
    function populateSelect(selectId, dataMap) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">--- Select ---</option>';

        const items = (Array.isArray(dataMap) ? dataMap : Object.entries(dataMap).map(([name, id]) => ({ id, name })))
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name


        items.forEach(item => {
            const id = item.id || item.name;
            const name = item.name;
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            if (id === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    // New helper function to populate weapon selects with category filtering and slot renaming
    function populateWeaponSelect(selectId, allWeaponsMap, weaponCategories, isHeavyWeaponsAugment) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">--- Select Weapon ---</option>';

    let allowedCategories = [];
    let slotName = '';

    if (selectId === 'secondary-weapon-select') {
        allowedCategories = ['secondary'];
        slotName = 'Secondary';
    } else if (selectId === 'primary-weapon-select') {
        allowedCategories = ['primary'];
        slotName = 'Primary';
    } else if (selectId === 'backup-weapon-select') {
        slotName = isHeavyWeaponsAugment ? 'Heavy' : 'Backup';
        allowedCategories = isHeavyWeaponsAugment ? ['heavy'] : ['backup'];
        const label = document.querySelector(`label[for="${selectId}"]`);
        if (label) label.textContent = slotName + ' :';
    }

    // --- Augment restrictions ---
    if (loadoutState.isProfessional) {
        allowedCategories = allowedCategories.filter(c => c !== 'primary');
    }
    if (loadoutState.isStudied) {
        allowedCategories = allowedCategories.filter(c => c !== 'primary' && c !== 'secondary');
    }
    if (loadoutState.isVersatile) {
        // Versatile overrides: allow backup, secondary, primary in both primary & secondary slots
        if (selectId === 'primary-weapon-select' || selectId === 'secondary-weapon-select') {
            allowedCategories = ['primary', 'secondary', 'backup'];
        }
    }

    // Populate options
    for (const [id, name] of Object.entries(allWeaponsMap)) {
        const category = weaponCategories[id];
        if (category && allowedCategories.includes(category)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            if (id === currentValue) option.selected = true;
            select.appendChild(option);
        }
    }
}


    /**
     * Function to filter and populate attachment selects based on augments and weapon compatibility.
     */
    function applyAttachmentRestrictions(selectId, weaponName, attachmentType) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">--- Select Attachment ---</option>';

        // Only show attachments of the correct type
        const relevantAttachments = allAttachmentsData.filter(a => a.type === attachmentType);
        
        // If no weapon is selected, show no options
        if (!weaponName) return;

        relevantAttachments.forEach(attachment => {
            const isTechnicianRequired = attachment.technician === "true";
            // Check compatibility using the weapon's *name* (e.g., "Major")
            const isCompatible = attachment.compatibility.includes(weaponName);
            
            let shouldShow = true;

            // 1. Technician Augment Check
            if (isTechnicianRequired && !loadoutState.isTechnician) {
                shouldShow = false;
                restrictionReason = 'Requires the Technician Augment.';
            }
            
            // 2. Weapon Compatibility Check (read from attachments.json)
            if (!isCompatible) {
                shouldShow = false;
                restrictionReason = 'Not compatible with ' + weaponName + '.';
            }

            if (shouldShow) {
                // Assuming attachment name is unique and can be used as the value.
                const option = document.createElement('option');
                option.value = attachment.name;
                option.textContent = attachment.name;
                if (attachment.name === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });

        // Clear invalid selection after filtering
        if (currentValue && !select.querySelector(`option[value="${currentValue}"]`)) {
             select.value = "";
        }
    }

    // --- DATA LOADING & POPULATION ---

    /**
     * Function to fetch and parse all required JSON files.
     */
    async function fetchLoadoutData() {
        try {
            // Fetch all three files
            const [idResponse, devicesResponse, attachmentsResponse] = await Promise.all([
                fetch('id.json'),
                fetch('devices.json'),
                fetch('attachments.json')
            ]);

            if (!idResponse.ok) throw new Error(`HTTP error! Status: ${idResponse.status}. Ensure id.json is in the root directory.`);
            if (!devicesResponse.ok) throw new Error(`HTTP error! Status: ${devicesResponse.status}. Ensure devices.json is in the root directory.`);
            if (!attachmentsResponse.ok) throw new Error(`HTTP error! Status: ${attachmentsResponse.status}. Ensure attachments.json is in the root directory.`);

            const idData = await idResponse.json();
            const devicesData = await devicesResponse.json();
            const attachmentsData = await attachmentsResponse.json();

            // Store global data
            allDevicesData = devicesData.map(d => ({ ...d, id: d.name })); // Use name as ID since no IDs are provided
            allAttachmentsData = attachmentsData;
            
            // Create a map of Weapon ID: Name for easy lookup (assuming idData.Weapons exists)
            if (idData.Weapons) {
                 for (const [name, id] of Object.entries(idData.Weapons)) {
                     allWeaponsData[id] = name; // {ID: Name}
                 }
            } else {
                // Fallback: Create placeholder weapon data for logic demonstration
                const placeholderWeapons = { "1": "Major", "2": "Deckard", "3": "Geist", "4": "Cerberus", "5": "Master-Key", "6": "Icarus", "7": "Custodian", "8": "Vigil", "9": "Inhibitor", "10": "Sentinel", "11": "Helix", "12": "Warrant" };
                for (const [id, name] of Object.entries(placeholderWeapons)) { allWeaponsData[id] = name; }
            }

            // Return combined data for initial population
            return { ...idData, Devices: allDevicesData };

        } catch (error) {
            console.error("Could not fetch loadout data. Please ensure all JSON files are in the root directory.", error);
            alert("Error loading loadout data. Check the browser console for details.");
            return null;
        }
    }
    
    /**
     * Initial data population and setup.
     */
    async function fetchAndPopulateData() {
        const data = await fetchLoadoutData();
        if (!data) return; 

        // Store Ammo data for restriction checks
        allAmmoData = data.Ammo; 

        // --- Initial Population using fetched data ---
        populateSelect('shell-select', data.Shells);
        
        AUGMENT_SELECTS.forEach(id => populateSelect(id, data.Augments));
        
        // Populate devices (using names as IDs)
        populateSelect('device-1-select', allDevicesData);
        populateSelect('device-2-select', allDevicesData);
        
        // Weapons (Initial call without Heavy Weapons augment)
        const allWeaponsMapNameID = data.Weapons || {};
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);
        populateWeaponSelect('secondary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);
        populateWeaponSelect('primary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);

        // Populate attachments (temporarily populate with all, filtering will happen in applyLoadoutRestrictions)
        populateSelect('secondary-optic-select', data.Optics);
        populateSelect('secondary-ammo-select', data.Ammo);
        SECONDARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));

        populateSelect('primary-optic-select', data.Optics);
        populateSelect('primary-ammo-select', data.Ammo);
        PRIMARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));
        
        // --- Add Event Listeners ---
        const allSelects = document.querySelectorAll('.container select');
        allSelects.forEach(select => {
            select.addEventListener('change', handleLoadoutChange);
        });

        // Run once on startup to ensure initial state and restrictions are applied
        updateLoadoutState();
        applyLoadoutRestrictions();
    }

    // --- LOGIC & RESTRICTIONS ---

    /**
     * Updates the global loadout state based on current selections.
     */
    function updateLoadoutState() {
        // Helper to get all selected values from a list of select IDs
        const getValues = (ids) => ids.map(id => document.getElementById(id)?.value).filter(val => val);
        
        loadoutState.augments = getValues(AUGMENT_SELECTS);
        loadoutState.devices = getValues(DEVICE_SELECTS);
        
        const allEquippedWeapons = getValues(WEAPON_SELECTS);
        loadoutState.weapons = { 
            backup: document.getElementById('backup-weapon-select')?.value || "",
            secondary: document.getElementById('secondary-weapon-select')?.value || "",
            primary: document.getElementById('primary-weapon-select')?.value || "",
            all: allEquippedWeapons 
        };

        loadoutState.modsSecondary = getValues(SECONDARY_MOD_SELECTS);
        loadoutState.modsPrimary = getValues(PRIMARY_MOD_SELECTS);

        // Check for special augments
        loadoutState.isTechnician = loadoutState.augments.includes(AUGMENT_TECHNICIAN);
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isHeavyWeapons = loadoutState.augments.includes(AUGMENT_HEAVY_WEAPONS);
        loadoutState.isExperimental = loadoutState.augments.includes(AUGMENT_EXPERIMENTAL);
        loadoutState.isNeurohacker = loadoutState.augments.includes(AUGMENT_NEUROHACKER);
        loadoutState.isProfessional = loadoutState.augments.includes(AUGMENT_PROFESSIONAL);
        loadoutState.isStudied = loadoutState.augments.includes(AUGMENT_STUDIED);

    }
    
    /**
     * Applies all loadout restrictions.
     */
    function applyLoadoutRestrictions() {
        updateLoadoutState();

        // 1. Rename Backup slot and filter weapons (must run first to ensure select options are correct)
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState.isHeavyWeapons);

        WEAPON_SELECTS.forEach(currentSelectId => {
             const currentSelect = document.getElementById(currentSelectId);
             const currentValue = currentSelect?.value;
             if (!currentValue) return;

             // Always enforce weapon uniqueness
             const otherSelectedWeapons = loadoutState.weapons.all.filter(id => id !== currentValue);
             const isDuplicate = otherSelectedWeapons.includes(currentValue);

             // Disable duplicate option in the current select
             Array.from(currentSelect.options).forEach(option => {
                 if (option.value && option.value !== currentValue) {
                     // Check against ALL other selected weapons in the other slots
                     const otherWeapons = loadoutState.weapons.all.filter(id => id !== option.value);
                     const shouldDisable = otherWeapons.includes(option.value);
                     option.disabled = shouldDisable;
                     option.title = shouldDisable ? 'Cannot equip multiple of the same weapon.' : '';
                 }
             });
             
             // Visual indication for invalid selection (e.g. if another select triggered the duplication)
             if (isDuplicate) {
                 currentSelect.classList.add('invalid-selection');
             } else {
                 currentSelect.classList.remove('invalid-selection');
             }
        });
        function applyModRestrictions(modSelectIds) {
    // Collect currently selected mods
    const selectedMods = modSelectIds
        .map(id => document.getElementById(id)?.value)
        .filter(val => val);

    modSelectIds.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentValue = select.value;

        Array.from(select.options).forEach(option => {
            if (!option.value) return; // skip placeholder

            const isSelectedElsewhere =
                selectedMods.includes(option.value) && option.value !== currentValue;

            option.disabled = isSelectedElsewhere;
            option.title = isSelectedElsewhere
                ? "Already equipped in another mod slot."
                : "";
        });

        // Mark invalid if current selection is duplicated
        const duplicates = selectedMods.filter(val => val === currentValue);
        if (duplicates.length > 1) {
            select.classList.add("invalid-selection");
        } else {
            select.classList.remove("invalid-selection");
        }
    });
}

AUGMENT_SELECTS.forEach(selectId => {
    const select = document.getElementById(selectId);
    const currentValue = select.value;

    Array.from(select.options).forEach(option => {
        const augmentId = option.value;

        // --- Already selected in another slot? ---
        const otherAugments = AUGMENT_SELECTS
            .filter(id => id !== selectId)
            .map(id => document.getElementById(id)?.value);

        const alreadySelected = otherAugments.includes(augmentId);

        // Apply disable
        if (augmentId !== currentValue) {
            option.disabled = alreadySelected;
            option.title = alreadySelected ? 'Already equipped in another slot.' : '';
        }

        // Mark invalid if current selection is invalid
        if (augmentId === currentValue && alreadySelected) {
            select.classList.add('invalid-selection');
        } else if (augmentId === currentValue) {
            select.classList.remove('invalid-selection');
        }
    });
});

        // 2. Device Augment Requirements (Neurohacker and Experimental)
        DEVICE_SELECTS.forEach(selectId => {
            const select = document.getElementById(selectId);
            const currentValue = select.value;
            
            Array.from(select.options).forEach(option => {
                const deviceName = option.textContent; 
                let requiresNeurohacker = [DEVICE_LOCKDOWN_NAME, DEVICE_CASCADE_NAME, DEVICE_PATHOGEN_NAME].includes(deviceName);
                // Check experimental status read from devices.json
                let requiresExperimental = allDevicesData.some(d => d.name === deviceName && d.experimental === "true");
                
                let shouldDisable = false;
                let restrictionReason = '';

                if (requiresNeurohacker && !loadoutState.isNeurohacker) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Neurohacker Augment.';
                } else if (requiresExperimental && !loadoutState.isExperimental) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Experimental Augment.';
                }
                const otherDeviceValues = DEVICE_SELECTS
                    .filter(id => id !== selectId)
                    .map(id => document.getElementById(id)?.value);

                if (otherDeviceValues.includes(option.value) && !loadoutState.isVersatile) {
                    shouldDisable = true;
                    restrictionReason = 'Already Equipped in another slot.';
                }

        // Apply the disable and tooltip
                if (option.value !== currentValue) {
                    option.disabled = shouldDisable;
                    option.title = shouldDisable ? restrictionReason : '';
                }
                if (loadoutState.isStudied) {
    const allowedStudiedDevices = ["Bolster", "Overcharge", "Shroud", "Reserve Stim"];
    DEVICE_SELECTS.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentValue = select.value;

        Array.from(select.options).forEach(option => {
            const deviceName = option.textContent;
            const shouldDisable = !allowedStudiedDevices.includes(deviceName);
            option.disabled = shouldDisable;
            option.title = shouldDisable ? "Studied augment restricts to specific devices." : "";
        });

        if (currentValue && !allowedStudiedDevices.includes(currentValue)) {
            select.classList.add("invalid-selection");
        } else {
            select.classList.remove("invalid-selection");
        }
    });
}


                
                // If current selection is invalid, mark the select element
                if (option.value === currentValue && shouldDisable) {
                    select.classList.add('invalid-selection');
                } else if (option.value === currentValue) {
                    select.classList.remove('invalid-selection');
                }
            });
        });

        // 5. Attachment Augment and Compatibility Requirements
        // Map selected weapon ID to its Name (e.g., "1" -> "Major")
        const secondaryWeaponName = allWeaponsData[loadoutState.weapons.secondary];
        const primaryWeaponName = allWeaponsData[loadoutState.weapons.primary];

        // Secondary Weapon Attachments
        applyAttachmentRestrictions('secondary-optic-select', secondaryWeaponName, 'Optic');
        applyAttachmentRestrictions('secondary-ammo-select', secondaryWeaponName, 'Ammo');
        SECONDARY_MOD_SELECTS.forEach(id => applyAttachmentRestrictions(id, secondaryWeaponName, 'Mod'));

        // Primary Weapon Attachments
        applyAttachmentRestrictions('primary-optic-select', primaryWeaponName, 'Optic');
        applyAttachmentRestrictions('primary-ammo-select', primaryWeaponName, 'Ammo');
        PRIMARY_MOD_SELECTS.forEach(id => applyAttachmentRestrictions(id, primaryWeaponName, 'Mod'));
        // Secondary mods
applyModRestrictions(SECONDARY_MOD_SELECTS);

// Primary mods
applyModRestrictions(PRIMARY_MOD_SELECTS);


        // The original script's custom ammo filtering logic (for Warrant, etc.) should be here.
        // I will assume that the original ammo filtering logic (using DEFAULT_GENERAL_AMMO_IDS, etc.)
        // is integrated here after the attachment restrictions are applied.
        // For the scope of this request, I'll rely on the compatibility check from attachments.json.
    }
    
    /**
     * Main event handler for all select changes.
     */
    function handleLoadoutChange(event) {
        // Clear any previous invalid selection visual indications before re-evaluating
        document.querySelectorAll('.invalid-selection').forEach(el => el.classList.remove('invalid-selection'));
        
        applyLoadoutRestrictions();
    }
    
    // --- INITIALIZATION ---
    fetchAndPopulateData();
});