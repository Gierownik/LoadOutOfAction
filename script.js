document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & DATA STORAGE ---

    // Augment IDs from id.json (Critical for logic checks)
    const AUGMENT_TECHNICIAN = "23";      // Technician augment ID 
    const AUGMENT_VERSATILE = "61";       // Versatile augment ID 
    const AUGMENT_EXPERIMENTAL = "17";    // Experimental augment ID 
    const AUGMENT_NEURO_HACKER = "51";    // Neuro-hacker augment ID 
    const AUGMENT_HEAVY_WEAPONS = "19";   // Heavy Weapons augment ID (for slot label change)

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
            all: [], // Combined list of all selected weapon names
        },
        modsSecondary: [],
        modsPrimary: [],
        isTechnician: false,
        isVersatile: false,
        isExperimental: false,
        isNeuroHacker: false,
        isHeavyWeapons: false,
    };

    // --- UTILITY FUNCTIONS ---

    // Helper function to get selected values from a list of select element IDs
    const getValues = (ids) => ids.map(id => document.getElementById(id)?.value).filter(val => val);

    /**
     * Generic function to populate select elements, applying sorting, filtering, and disabling.
     * * IMPORTANT CHANGE: This function now handles uniqueness logic internally:
     * - If !allowDuplicates, item is FILTERED if found in otherSelectedItems.
     * - If allowDuplicates, item is DISABLED if found in otherSelectedItems (the new 'gray out' feature).
     * * @param {string} selectId - The ID of the <select> element.
     * @param {Object} dataMap - Map of item name (or ID) to item object (or ID).
     * @param {Object} restrictions - Object with shouldFilter, shouldDisable, and allowsDuplicates functions.
     * @param {Set<string>} otherSelectedItems - Set of names/IDs currently selected in *other* relevant slots.
     * @param {boolean} isIdMap - True if dataMap keys/values are IDs, not names (used for Augments).
     */
    function populateSelectWithRestrictions(selectId, dataMap, restrictions, otherSelectedItems = new Set(), isIdMap = false) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;

        const currentSelection = selectElement.value;
        selectElement.innerHTML = '';

        const emptyOption = document.createElement('option');
        emptyOption.value = "";
        emptyOption.textContent = "Select...";
        selectElement.appendChild(emptyOption);

        let foundCurrent = false;

        // Sort items alphabetically by name
        const sortableItems = Object.entries(dataMap).map(([key, itemOrId]) => ({
            name: isIdMap ? key : itemOrId.name,
            key: key,
            item: isIdMap ? itemOrId : itemOrId,
            value: isIdMap ? itemOrId : key // ID for ID map, Name for object map
        }));

        sortableItems.sort((a, b) => a.name.localeCompare(b.name));

        sortableItems.forEach(itemEntry => {
            const { name, key, item, value } = itemEntry;

            let shouldBeDisabled = false;

            // 1. Uniqueness Check (New/Updated Logic)
            if (otherSelectedItems.has(value)) {
                // Item is selected in another slot
                if (!restrictions.allowDuplicates(item)) {
                    // Augments/Weapons: Filter out completely
                    return; 
                } else {
                    // Devices (if Versatile is on): Gray out (disable)
                    shouldBeDisabled = true; 
                }
            }

            // 2. Check for specific filtering (e.g., weapon slot compatibility)
            if (restrictions.shouldFilter(item, selectId)) {
                return; 
            }

            // 3. Create the option element
            const option = document.createElement('option');
            option.value = value;
            option.textContent = name;

            // 4. Check for *other* disabling reasons (e.g., Augment requirements)
            if (restrictions.shouldDisable(item) || shouldBeDisabled) {
                option.disabled = true;
            }

            // Re-select the previously selected value
            if (value === currentSelection) {
                // An item that is currently selected must always be visible/selectable in its own slot
                // unless it is invalid due to an Augment rule (handled below).
                option.disabled = false; 
                option.selected = true;
                foundCurrent = true;
            }

            selectElement.appendChild(option);
        });

        // If the previously selected item is now filtered out OR disabled (by an Augment rule), clear the selection
        const currentOption = selectElement.querySelector(`option[value="${currentSelection}"]`);
        if (currentSelection && (!foundCurrent || (currentOption && currentOption.disabled))) {
            selectElement.value = "";
            selectElement.dispatchEvent(new Event('change')); 
        }
    }

    // Generic function for initial population of static lists (Shells, Augments)
    function populateSelect(selectId, dataMap) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;

        const sortedKeys = Object.keys(dataMap).sort();
        selectElement.innerHTML = '<option value="">Select...</option>';

        sortedKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = dataMap[key]; // ID
            option.textContent = key; // Name
            selectElement.appendChild(option);
        });
    }

    // --- DATA FETCHING & PROCESSING ---

    async function loadAllData() {
        try {
            const [idRes, devicesRes, weaponsRes, attachmentsRes] = await Promise.all([
                fetch('id.json'),
                fetch('devices.json'),
                fetch('weapons.json'),
                fetch('attachments.json')
            ]);

            const idJson = await idRes.json();
            const devicesJson = await devicesRes.json();
            const weaponsJson = await weaponsRes.json();
            const attachmentsJson = await attachmentsRes.json();

            const createNameMap = (data) => {
                const map = {};
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        map[item.name] = item;
                    });
                }
                return map;
            };

            allData.augments = idJson.Augments || {};
            allData.devices = createNameMap(devicesJson);
            allData.weapons = createNameMap(weaponsJson);
            allData.attachments = createNameMap(attachmentsJson);

            // Initial population of static lists (Shells, which don't have restrictions)
            populateSelect('shell-select', idJson.Shells || {});

        } catch (e) {
            console.error("Failed to load loadout data from JSON files. Ensure files are accessible.", e);
        }
    }

    // --- POPULATION & RESTRICTION LOGIC IMPLEMENTATION ---

    function updateLoadoutState() {
        // Augment Checks (Augments are selected by ID)
        loadoutState.augments = getValues(AUGMENT_SELECTS);
        loadoutState.isTechnician = loadoutState.augments.includes(AUGMENT_TECHNICIAN);
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isExperimental = loadoutState.augments.includes(AUGMENT_EXPERIMENTAL);
        loadoutState.isNeuroHacker = loadoutState.augments.includes(AUGMENT_NEURO_HACKER);
        loadoutState.isHeavyWeapons = loadoutState.augments.includes(AUGMENT_HEAVY_WEAPONS);

        // Weapon Selections (Weapons are selected by Name)
        loadoutState.weapons.backup = document.getElementById('backup-weapon-select')?.value || "";
        loadoutState.weapons.secondary = document.getElementById('secondary-weapon-select')?.value || "";
        loadoutState.weapons.primary = document.getElementById('primary-weapon-select')?.value || "";
        loadoutState.weapons.all = getValues(WEAPON_SELECTS);

        // Device Selections (Devices are selected by Name)
        loadoutState.devices = getValues(DEVICE_SELECTS);
    }

    function updateBackupLabel() {
        const backupLabel = document.querySelector('label[for="backup-weapon-select"]');
        if (backupLabel) {
            backupLabel.textContent = loadoutState.isHeavyWeapons ? 'Heavy :' : 'Backup :';
        }
    }

    /**
     * Logic for Augment Uniqueness. (FIXED: Now allows current selection to remain)
     */
    function populateAugmentSelects() {
        const allAugments = allData.augments; // { Name: ID }

        AUGMENT_SELECTS.forEach(selectId => {
            const currentSelectedValue = document.getElementById(selectId)?.value;

            // Collect all selected Augment IDs from other slots
            const otherSelectedAugmentIDs = new Set(loadoutState.augments.filter(id => id !== currentSelectedValue));

            populateSelectWithRestrictions(selectId, allAugments, {
                // Augments have no specific filtering/disabling rules beyond uniqueness
                shouldFilter: () => false, 
                shouldDisable: () => false,
                allowDuplicates: () => false // Augments do NOT allow duplicates (will be FILTERED out)
            }, otherSelectedAugmentIDs, true); // true since dataMap is an ID map
        });
    }

    /**
     * Logic for Device Selection Restrictions. (UPDATED: Implements gray-out logic for Versatile)
     */
    function populateDeviceSelects() {
        const isExperimentalEquipped = loadoutState.isExperimental;
        const isNeuroHackerEquipped = loadoutState.isNeuroHacker;
        const isVersatileEquipped = loadoutState.isVersatile;
        const allDevices = allData.devices;

        DEVICE_SELECTS.forEach(selectId => {    
            const currentSelectedValue = document.getElementById(selectId)?.value;
            // Collect all selected Device NAMES from other slots
            const otherSelectedDeviceNames = new Set(loadoutState.devices.filter(name => name !== currentSelectedValue));

            populateSelectWithRestrictions(selectId, allDevices, {
                // Filtering Logic (only for general item filtering, not uniqueness)
                shouldFilter: () => false, 

                // Disabling/Graying Out Logic (handles Experimental/Neuro-hacker requirements)
                shouldDisable: (device) => {
                    const isExperimental = device.experimental === "true"; 
                    const isNeuroHackerDevice = NEURO_HACKER_DEVICE_NAMES.includes(device.name);

                    // 1. Experimental device requires Experimental augment
                    if (isExperimental && !isExperimentalEquipped) {
                        return true; 
                    }

                    // 2. Neuro-hacker device requires Neuro-hacker augment
                    if (isNeuroHackerDevice && !isNeuroHackerEquipped) {
                        return true;
                    }

                    return false;
                },
                allowDuplicates: () => isVersatileEquipped // Devices allow duplicates if Versatile is on (will be DISABLED/grayed out)
            }, otherSelectedDeviceNames, false); // false since dataMap is an object map
        });
    }

    /**
     * Logic for Weapon Selection Restrictions.
     */
    function populateWeaponSelects() {
        const isVersatileEquipped = loadoutState.isVersatile;
        const allWeapons = allData.weapons;

        WEAPON_SELECTS.forEach(selectId => {

            let expectedWeaponSlot;
            // Map the HTML select ID to the expected slot name in weapons.json
            if (selectId === 'backup-weapon-select') expectedWeaponSlot = SLOT_BACKUP;
            else if (selectId === 'secondary-weapon-select') expectedWeaponSlot = SLOT_SIDEARM; // Note: 'Sidearm' in weapons.json
            else if (selectId === 'primary-weapon-select') expectedWeaponSlot = SLOT_PRIMARY;
            else return;

            const currentSelectedValue = document.getElementById(selectId)?.value;
            // Collect all selected Weapon NAMES from other slots
            const otherSelectedWeaponNames = new Set(loadoutState.weapons.all.filter(name => name !== currentSelectedValue));

            populateSelectWithRestrictions(selectId, allWeapons, {
                // Filtering Logic (slot restrictions)
                shouldFilter: (weapon) => {
                    const weaponSlot = weapon.stats.slot; 
                    const isHeavyWeapon = weaponSlot === SLOT_HEAVY;

                    // 1. Heavy weapons are ALWAYS restricted to the Backup slot
                    if (isHeavyWeapon) {
                        // Filter out if current select is NOT the backup slot
                        return expectedWeaponSlot !== SLOT_BACKUP; 
                    } 

                    // 2. If the current slot is Backup, enforce strict slot matching (Versatile DOES NOT apply here)
                    if (expectedWeaponSlot === SLOT_BACKUP) {
                        // Only Heavy (handled above) or Backup weapons are allowed here.
                        return weaponSlot !== SLOT_BACKUP;
                    }

                    // 3. If Versatile IS equipped, allow all non-Heavy weapons in Primary/Secondary slots
                    if (isVersatileEquipped) {
                        return false; 
                    }

                    // 4. Strict slot matching for Primary/Secondary if Versatile is NOT equipped
                    if (weaponSlot !== expectedWeaponSlot) {
                        return true; 
                    }

                    return false; // Show the weapon (it passed all filters)
                },

                shouldDisable: () => false, // Weapons are either shown or filtered, not disabled by Augments
                allowDuplicates: () => false // Weapons never allow duplicates (will be FILTERED out)
            }, otherSelectedWeaponNames, false);
        });
    }

    /**
     * Logic for Attachment Restrictions (Compatibility and Technician Ammo).
     */
    function populateAttachmentSelects(weaponSelectId) {
        let weaponName;
        let ammoSelectId;
        let opticSelectId;
        let modSelectIds;

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
                if (weaponName && (!attachment.compatibility || !attachment.compatibility.includes(weaponName))) { 
                    return true;
                }
                return false;
            },

            shouldDisable: (attachment) => {
                // Gray-out logic only applies to Ammo type
                if (attachment.type === 'Ammo') {
                    const isTechnicianAmmo = attachment.technician === "true"; 

                    if (isTechnicianAmmo && !isTechnicianEquipped) {
                        return true;
                    }
                }
                return false;
            },
            allowDuplicates: () => true // Attachments can be duplicated in their own slots
        });

        // Apply restrictions to all relevant attachment selectors
        populateSelectWithRestrictions(ammoSelectId, allAttachments, attachmentRestrictions('Ammo'));
        populateSelectWithRestrictions(opticSelectId, allAttachments, attachmentRestrictions('Optic'));
        modSelectIds.forEach(selectId => {
            populateSelectWithRestrictions(selectId, allAttachments, attachmentRestrictions('Mod'));
        });
    }

    // --- MAIN EVENT HANDLER ---

    function handleLoadoutChange() {
        // 1. Update the state based on the current selections
        updateLoadoutState();

        // 2. Update the Backup/Heavy label
        updateBackupLabel();

        // 3. Re-populate/Filter/Disable all select boxes based on the new state

        // A. Augment uniqueness (must run first as it changes loadoutState booleans)
        populateAugmentSelects();

        // B. Weapon Slot logic & Uniqueness
        populateWeaponSelects(); 

        // C. Device logic & Uniqueness/Disabling
        populateDeviceSelects();

        // D. Attachment logic (depends on selected weapons)
        populateAttachmentSelects('secondary-weapon-select');
        populateAttachmentSelects('primary-weapon-select');

        // Re-run loadout state update to capture changes from filtering/clearing the selections
        updateLoadoutState();
    }

    // --- INITIALIZATION ---

    async function init() {
        await loadAllData(); 

        // Initial population of restricted/sorted fields (Augments, Devices, Weapons, Attachments)
        handleLoadoutChange();

        // --- Add Event Listeners ---
        const allSelects = document.querySelectorAll('.container select');
        allSelects.forEach(select => {
            select.addEventListener('change', handleLoadoutChange);
        });
    }

    init();
});