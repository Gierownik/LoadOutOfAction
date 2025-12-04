document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & DATA STORAGE ---
    
    // IDs for logic checks (Values come from the id.json file)
    const AUGMENT_TECHNICIAN = "23";      // Unlocks technician-only attachments
    const AUGMENT_VERSATILE = "61";       // Allows duplicate devices, but NOT weapons (new logic)
    const AUGMENT_HEAVY_WEAPONS = "19";   // Renames backup slot and allows heavy weapons
    const AUGMENT_EXPERIMENTAL = "17";    // Required for experimental devices
    const AUGMENT_NEUROHACKER = "68";     // Placeholder ID for Neurohacker (assumed next ID)
    const AUGMENT_PROFESSIONAL = "50";    // New: Disallows Primary Weapons (Placeholder ID)
    const AUGMENT_STUDIED = "76";         // New: Disallows Primary/Secondary Weapons, restricts devices (Placeholder ID)

    // Device Names requiring Neurohacker (since IDs are unavailable)
    const DEVICE_LOCKDOWN_NAME = "Lockdown";
    const DEVICE_CASCADE_NAME = "Cascade";
    const DEVICE_PATHOGEN_NAME = "Pathogen";

    // New: Devices allowed only with Studied Augment (Use names as IDs)
    const STUDIED_ALLOWED_DEVICES = [
        "Bolster", 
        "Overcharge", 
        "Shroud", 
        "Reserve Stim"
    ]; 
    
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
        isNeurohacker: false,
        isProfessional: false, // New state flag
        isStudied: false       // New state flag
    };
    
    // --- UTILITY FUNCTIONS ---

    /**
     * Generic function to populate a select element.
     * NOW SORTS ITEMS ALPHABETICALLY BY NAME.
     */
    function populateSelect(selectId, dataMap) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">--- Select ---</option>';

        let items = Array.isArray(dataMap) ? dataMap : Object.entries(dataMap).map(([name, id]) => ({ id: id || name, name: name }));
        
        // --- CHANGE 1: Sort items alphabetically by name ---
        items.sort((a, b) => a.name.localeCompare(b.name));

        items.forEach(item => {
            const id = item.id || item.name;
            const name = item.name;
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            
            // Check for uniqueness exclusion from other selections
            let isExcluded = false;
            let restrictionReason = '';

            // This only handles Augment uniqueness. Other uniqueness is handled in applyLoadoutRestrictions.
            if (selectId.startsWith('augment-')) {
                 const otherAugmentValues = loadoutState.augments.filter(val => val !== currentValue);
                 if (otherAugmentValues.includes(id)) {
                     isExcluded = true;
                     restrictionReason = 'Cannot equip multiple of the same Augment.';
                 }
            }


            if (id === currentValue) {
                option.selected = true;
            } else if (isExcluded) {
                 // Disables and greys out duplicates
                 option.disabled = true;
                 option.title = restrictionReason;
                 option.classList.add('restricted-option');
            }
            select.appendChild(option);
        });
    }

    // New helper function to populate weapon selects with category filtering and slot renaming
    function populateWeaponSelect(selectId, allWeaponsMap, weaponCategories, loadoutState) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">--- Select Weapon ---</option>';

        let allowedCategories = [];
        let slotName = '';

        if (selectId === 'secondary-weapon-select') {
            slotName = 'Secondary';
            // Versatile allows more categories in Secondary slot (CHANGE 4)
            allowedCategories = loadoutState.isVersatile ? ['secondary', 'primary', 'backup', 'heavy'] : ['secondary'];
        } else if (selectId === 'primary-weapon-select') {
            slotName = 'Primary';
            // Versatile allows more categories in Primary slot (CHANGE 4)
            allowedCategories = loadoutState.isVersatile ? ['secondary', 'primary', 'backup', 'heavy'] : ['primary'];
        } else if (selectId === 'backup-weapon-select') {
            // Renames the slot based on the augment
            slotName = loadoutState.isHeavyWeapons ? 'Heavy' : 'Backup';
            // Heavy Weapons augment allows both 'backup' and 'heavy' weapon types
            allowedCategories = loadoutState.isHeavyWeapons ? ['backup', 'heavy'] : ['backup'];

            // Rename the label dynamically
            const label = document.querySelector(`label[for="${selectId}"]`);
            if (label) {
                label.textContent = slotName + ' :';
            }
        } else {
            return;
        }

        // Convert to array of objects for sorting and filtering
        let weaponsArray = Object.entries(allWeaponsMap)
            .map(([id, name]) => ({ id, name, category: weaponCategories[id] }))
            .filter(w => w.category && allowedCategories.includes(w.category));

        // Sort alphabetically by name
        weaponsArray.sort((a, b) => a.name.localeCompare(b.name));


        // allWeaponsMap is {ID: Name}
        weaponsArray.forEach(weapon => {
            const id = weapon.id;
            const name = weapon.name;
            const category = weapon.category;
            
            let shouldDisable = false;
            let restrictionReason = '';
            
            // Check against Professional Augment (CHANGE 5)
            if (loadoutState.isProfessional && category === 'primary') {
                shouldDisable = true;
                restrictionReason = 'Primary weapons are not allowed with the Professional Augment.';
            }

            // Check against Studied Augment (CHANGE 6)
            if (loadoutState.isStudied && (category === 'primary' || category === 'secondary')) {
                shouldDisable = true;
                restrictionReason = 'Primary and Secondary weapons are not allowed with the Studied Augment.';
            }
            
            // Uniqueness Check (Always enforced for weapons) (CHANGE 2)
            const otherSelectedWeapons = loadoutState.weapons.all.filter(val => val !== currentValue);
            if (otherSelectedWeapons.includes(id)) {
                 shouldDisable = true;
                 restrictionReason = 'Cannot equip multiple of the same weapon.';
            }

            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            
            if (id === currentValue) {
                option.selected = true;
            } else if (shouldDisable) {
                 option.disabled = true;
                 option.title = restrictionReason;
                 option.classList.add('restricted-option');
            }
            select.appendChild(option);
        });

        // Clear invalid selection after filtering
        if (currentValue && !select.querySelector(`option[value="${currentValue}"]`)) {
             select.value = "";
        }
    }

    /**
     * Function to filter and populate attachment selects based on augments and weapon compatibility.
     * NOW CHECKS TECHNICIAN FOR AMMO/MODS/OPTICS (CHANGE 3)
     */
    function applyAttachmentRestrictions(selectId, weaponName, attachmentType) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">--- Select Attachment ---</option>';

        // Only show attachments of the correct type
        let relevantAttachments = allAttachmentsData.filter(a => a.type === attachmentType);
        
        // Sort alphabetically by name (CHANGE 1)
        relevantAttachments.sort((a, b) => a.name.localeCompare(b.name));

        // If no weapon is selected, show no options
        if (!weaponName) return;

        relevantAttachments.forEach(attachment => {
            const isTechnicianRequired = attachment.technician === "true";
            // Check compatibility using the weapon's *name* (e.g., "Major")
            const isCompatible = attachment.compatibility.includes(weaponName);
            
            let shouldDisable = false;
            let restrictionReason = '';

            // 1. Weapon Compatibility Check (read from attachments.json)
            if (!isCompatible) {
                // Do not add incompatible options to the select at all
                return;
            }
            
            // 2. Technician Augment Check (CHANGE 3)
            if (isTechnicianRequired && !loadoutState.isTechnician) {
                shouldDisable = true;
                restrictionReason = 'Requires the Technician Augment.';
            }

            // 3. Uniqueness Check (per weapon) (CHANGE 2.2)
            const isDuplicate = applyAttachmentUniqueness(selectId, attachment.name);
            if (isDuplicate) {
                 shouldDisable = true;
                 restrictionReason = 'Cannot equip multiple of the same attachment on this weapon.';
            }


            // Assuming attachment name is unique and can be used as the value.
            const option = document.createElement('option');
            option.value = attachment.name;
            option.textContent = attachment.name;
            
            if (attachment.name === currentValue) {
                option.selected = true;
            } else if (shouldDisable) {
                 option.disabled = true;
                 option.title = restrictionReason;
                 option.classList.add('restricted-option');
            }
            select.appendChild(option);
        });

        // Clear invalid selection after filtering
        if (currentValue && !select.querySelector(`option[value="${currentValue}"]`)) {
             select.value = "";
        }
    }
    
    /**
     * Helper to enforce attachment uniqueness *per weapon* (CHANGE 2.2)
     * Checks if the given attachmentName is already selected on the current weapon's other slots.
     */
    function applyAttachmentUniqueness(currentSelectId, attachmentName) {
        if (!attachmentName) return false;

        let modSelectIds = [];
        let otherMods = [];
        
        if (SECONDARY_MOD_SELECTS.includes(currentSelectId) || currentSelectId.includes('secondary-')) {
            // Check all secondary attachments (optic, ammo, all mods)
            modSelectIds = ['secondary-optic-select', 'secondary-ammo-select', ...SECONDARY_MOD_SELECTS];
        } else if (PRIMARY_MOD_SELECTS.includes(currentSelectId) || currentSelectId.includes('primary-')) {
            // Check all primary attachments (optic, ammo, all mods)
            modSelectIds = ['primary-optic-select', 'primary-ammo-select', ...PRIMARY_MOD_SELECTS];
        } else {
            return false;
        }

        // Get all selected attachment names for the current weapon (excluding the current select's value)
        otherMods = modSelectIds
            .filter(id => id !== currentSelectId)
            .map(id => document.getElementById(id)?.value)
            .filter(val => val);

        return otherMods.includes(attachmentName);
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

        // Run once on startup to ensure initial state and restrictions are applied
        updateLoadoutState(); // Must run first to get initial state for restricted options

        // --- Initial Population using fetched data ---
        populateSelect('shell-select', data.Shells);
        
        AUGMENT_SELECTS.forEach(id => populateSelect(id, data.Augments));
        
        // Populate devices (using names as IDs)
        // Devices will be filtered/restricted in applyLoadoutRestrictions()
        populateDevicesSelects(allDevicesData);
        
        // Weapons (Initial call without Heavy Weapons augment)
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState);
        populateWeaponSelect('secondary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState);
        populateWeaponSelect('primary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState);

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
        applyLoadoutRestrictions();
    }
    
    // New function to populate devices and handle Studied Augment restrictions (CHANGE 6)
    function populateDevicesSelects(devicesData) {
        DEVICE_SELECTS.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = '<option value="">--- Select Device ---</option>';

            // Sort alphabetically (CHANGE 1)
            let items = [...devicesData].sort((a, b) => a.name.localeCompare(b.name));

            items.forEach(item => {
                const id = item.id;
                const name = item.name;
                
                let shouldDisable = false;
                let restrictionReason = '';
                
                // Studied Augment Device Restriction (CHANGE 6)
                if (loadoutState.isStudied && !STUDIED_ALLOWED_DEVICES.includes(name)) {
                     shouldDisable = true;
                     restrictionReason = 'The Studied Augment only allows specific devices.';
                }
                
                // Device Uniqueness Check (will be handled in applyLoadoutRestrictions for visual indication on selection)
                // We don't disable other options here because Versatile can override it.

                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                
                if (id === currentValue) {
                    option.selected = true;
                } else if (shouldDisable) {
                    option.disabled = true;
                    option.title = restrictionReason;
                    option.classList.add('restricted-option');
                }
                select.appendChild(option);
            });
        });
        
        // Clear invalid selection after filtering
        DEVICE_SELECTS.forEach(selectId => {
             const select = document.getElementById(selectId);
             if (select.value && !select.querySelector(`option[value="${select.value}"]`)) {
                 select.value = "";
             }
        });
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
        loadoutState.isProfessional = loadoutState.augments.includes(AUGMENT_PROFESSIONAL); // New
        loadoutState.isStudied = loadoutState.augments.includes(AUGMENT_STUDIED);           // New
    }
    
    /**
     * Applies all loadout restrictions.
     */
    function applyLoadoutRestrictions() {
        // Clear any previous invalid selection visual indications before re-evaluating
        document.querySelectorAll('.invalid-selection').forEach(el => el.classList.remove('invalid-selection'));
        document.querySelectorAll('.restricted-option').forEach(el => el.classList.remove('restricted-option'));
        
        updateLoadoutState();

        // 1. Augment Uniqueness & Weapon filtering (requires loadoutState)
        // Must re-populate Augments to enforce uniqueness of the selected options against others (CHANGE 2)
        const augmentsData = (document.getElementById('augment-1-select')?.options || []).map(opt => ({ id: opt.value, name: opt.textContent })).filter(a => a.id && a.id !== '--- Select ---');
        AUGMENT_SELECTS.forEach(id => populateSelect(id, augmentsData.filter(a => a.name !== '--- Select ---').map(a => a.name)));
        
        // Re-populate Devices to handle Studied augment filter (CHANGE 6)
        populateDevicesSelects(allDevicesData);
        
        // Re-populate weapons to handle Heavy Weapons/Versatile/Professional/Studied filters (CHANGE 4, 5, 6)
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState);
        populateWeaponSelect('secondary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState);
        populateWeaponSelect('primary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState);

        // 2. Weapon Uniqueness Check (Now handled within populateWeaponSelect)

        // 3. Device Uniqueness (Custom logic: Versatile allows duplicate devices, NOT weapons) (CHANGE 2.1)
        DEVICE_SELECTS.forEach(currentSelectId => {
            const currentSelect = document.getElementById(currentSelectId);
            const currentValue = currentSelect?.value;
            if (!currentValue) return;

            // Devices can be duplicated only if Versatile is active
            const otherSelectedDevices = loadoutState.devices.filter(id => id !== currentValue);
            const isDuplicate = otherSelectedDevices.includes(currentValue);
            
            Array.from(currentSelect.options).forEach(option => {
                const isCurrent = option.value === currentValue;
                const otherDevices = loadoutState.devices.filter(id => id !== option.value);
                const shouldDisable = otherDevices.includes(option.value) && !loadoutState.isVersatile;
                
                // Disable other options if they would create a duplicate without Versatile
                if (!isCurrent) {
                     option.disabled = shouldDisable;
                     option.title = shouldDisable ? 'Cannot equip multiple of the same device without the Versatile augment.' : '';
                     if (shouldDisable) option.classList.add('restricted-option');
                }
            });
            
            // Mark the current selection invalid if it is a duplicate without Versatile
            if (isDuplicate && !loadoutState.isVersatile) {
                currentSelect.classList.add('invalid-selection');
            } else {
                currentSelect.classList.remove('invalid-selection');
            }
        });

        // 4. Device Augment Requirements (Neurohacker and Experimental)
        DEVICE_SELECTS.forEach(selectId => {
            const select = document.getElementById(selectId);
            const currentValue = select.value;
            
            Array.from(select.options).forEach(option => {
                const deviceName = option.textContent; 
                let requiresNeurohacker = [DEVICE_LOCKDOWN_NAME, DEVICE_CASCADE_NAME, DEVICE_PATHOGEN_NAME].includes(deviceName);
                // Check experimental status read from devices.json
                let requiresExperimental = allDevicesData.some(d => d.name === deviceName && d.experimental === "true");
                
                let shouldDisable = option.disabled; // Keep existing studied/uniqueness disable state
                let restrictionReason = option.title;
                let addClass = false;

                if (requiresNeurohacker && !loadoutState.isNeurohacker) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Neurohacker Augment.';
                    addClass = true;
                } else if (requiresExperimental && !loadoutState.isExperimental) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Experimental Augment.';
                    addClass = true;
                }

                // Apply restriction (except to the current selection, which is instead marked invalid below)
                if (option.value !== currentValue) {
                    option.disabled = shouldDisable;
                    option.title = shouldDisable ? restrictionReason : option.title;
                    if (addClass || shouldDisable) option.classList.add('restricted-option');
                }
                
                // If current selection is invalid, mark the select element
                if (option.value === currentValue && shouldDisable) {
                    select.classList.add('invalid-selection');
                } else if (option.value === currentValue && !shouldDisable && select.classList.contains('invalid-selection')) {
                    // Check if it's currently invalid from a previous check
                    select.classList.remove('invalid-selection');
                }
            });
        });

        // 5. Attachment Augment and Compatibility Requirements (and uniqueness per weapon - CHANGE 2.2)
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
        
        // Final check to clear invalid selections if weapons/augments that were causing them are removed
        if (!loadoutState.weapons.secondary) {
            document.querySelectorAll(SECONDARY_MOD_SELECTS.map(id => `#${id}`).join(', ')).forEach(el => el.classList.remove('invalid-selection'));
        }
        if (!loadoutState.weapons.primary) {
            document.querySelectorAll(PRIMARY_MOD_SELECTS.map(id => `#${id}`).join(', ')).forEach(el => el.classList.remove('invalid-selection'));
        }
    }
    
    /**
     * Main event handler for all select changes.
     */
    function handleLoadoutChange(event) {
        // We now rely on applyLoadoutRestrictions to clear visual indications
        applyLoadoutRestrictions();
    }
    
    // --- INITIALIZATION ---
    fetchAndPopulateData();
});