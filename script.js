document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & DATA STORAGE ---
    
    // Augment IDs for logic checks
    const AUGMENT_TECHNICIAN = "23";      // Unlocks all general ammo + Incendiary Grenade for Warrant
    const AUGMENT_VERSATILE = "61";       // Allows duplicate devices (No longer allows duplicate weapons)
    const AUGMENT_HEAVY_WEAPONS = "19";   // Renames backup slot, unlocks heavy weapons, changes backup slot content
    const AUGMENT_NEURO_HACKER = "68";    // Unlocks special devices

    // Item IDs for specific rules
    const WEAPON_WARRANT = "12";          
    const DEVICE_SPECIAL_IDS = ["21", "23", "22"]; // Cascade, Lockdown, Pathogen
    const WEAPON_HEAVY_IDS = ["16", "15", "20"];   // Blackout, Umibozu, Hole-punch
    const WEAPON_BACKUP_DEFAULT_IDS = ["17", "22", "23", "1"]; // Akanami, Dusters, Fists, TTK

    // Ammo ID Lists (from previous step)
    const DEFAULT_GENERAL_AMMO_IDS = ["21", "20", "19", "26", "35"]; 
    const WARRANT_DEFAULT_AMMO_IDS = ["38", "39", "41"];             
    const WARRANT_TECHNICIAN_AMMO_ID = "40";                         
    
    let allData = {}; // Stores all data fetched from JSON (including Weapons, Devices, Ammo)

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
        weapons: { backup: "", secondary: "", primary: "", all: [] },
        modsSecondary: [],
        modsPrimary: [],
        isTechnician: false,
        isVersatile: false,
        isHeavyWeapons: false,
        isNeuroHacker: false
    };

    // --- DATA LOADING & POPULATION ---

    async function fetchLoadoutData() {
        try {
            const response = await fetch('id.json');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}.`);
            }
            return await response.json();
        } catch (error) {
            console.error("Could not fetch loadout data. Please ensure your web server is running and 'id.json' exists.", error);
            alert("Error loading loadout data. Check the browser console for details.");
            return null;
        }
    }

    // --- STATE MANAGEMENT ---

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

        loadoutState.modsSecondary = getValues(SECONDARY_MOD_SELECTS);
        loadoutState.modsPrimary = getValues(PRIMARY_MOD_SELECTS);

        loadoutState.isTechnician = loadoutState.augments.includes(AUGMENT_TECHNICIAN);
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isHeavyWeapons = loadoutState.augments.includes(AUGMENT_HEAVY_WEAPONS);
        loadoutState.isNeuroHacker = loadoutState.augments.includes(AUGMENT_NEURO_HACKER);
    }
    
    // --- CORE RESTRICTION FUNCTIONS ---

    /**
     * General restriction function for any dropdown based on an allowed list of IDs.
     */
    function applyDropdownRestriction(selectId, allowedIds, isUniqueCheck, selectedValues) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        const allowedSet = new Set(allowedIds);
        
        Array.from(select.options).forEach(option => {
            const id = option.value;
            
            if (id === "") {
                option.disabled = false;
                return;
            }

            let isAllowed = allowedSet.has(id);

            // Apply uniqueness check if requested (for Augments, Devices, Weapons)
            if (isAllowed && isUniqueCheck) {
                // If this option is already selected in another slot
                const isSelectedInOtherSlot = selectedValues.filter(val => val === id && val !== currentValue).length > 0;
                if (isSelectedInOtherSlot) {
                    isAllowed = false;
                }
            }
            
            option.disabled = !isAllowed;
            
            // Clear selection if the current item is now disabled
            if (!isAllowed && id === currentValue) {
                select.value = "";
            }
        });
    }

    /**
     * Applies all Augment, Mod, Weapon, and Device uniqueness and availability rules.
     */
    function applyAvailabilityAndUniquenessRestrictions() {
        
        // --- 1. Augment Uniqueness ---
        const allAugmentIds = Object.values(allData.Augments).map(String);
        AUGMENT_SELECTS.forEach(id => {
            applyDropdownRestriction(id, allAugmentIds, true, loadoutState.augments.filter(val => val !== AUGMENT_VERSATILE));
        });

        // --- 2. Mod Uniqueness (Per Weapon) ---
        const allModIds = Object.values(allData.Mods).map(String);
        applyDropdownRestriction('secondary-mod-1-select', allModIds, true, loadoutState.modsSecondary);
        applyDropdownRestriction('secondary-mod-2-select', allModIds, true, loadoutState.modsSecondary);
        applyDropdownRestriction('secondary-mod-3-select', allModIds, true, loadoutState.modsSecondary);
        applyDropdownRestriction('secondary-mod-4-select', allModIds, true, loadoutState.modsSecondary);
        applyDropdownRestriction('primary-mod-1-select', allModIds, true, loadoutState.modsPrimary);
        applyDropdownRestriction('primary-mod-2-select', allModIds, true, loadoutState.modsPrimary);
        applyDropdownRestriction('primary-mod-3-select', allModIds, true, loadoutState.modsPrimary);
        applyDropdownRestriction('primary-mod-4-select', allModIds, true, loadoutState.modsPrimary);

        // --- 3. Device Availability (Neuro-hacker) and Uniqueness (Conditional Versatile) ---
        const allDeviceIds = Object.values(allData.Devices).map(String);
        let allowedDeviceIds = allDeviceIds.filter(id => {
            const isSpecialDevice = DEVICE_SPECIAL_IDS.includes(id);
            // Block special devices unless Neuro-hacker is equipped
            return !isSpecialDevice || loadoutState.isNeuroHacker;
        });

        DEVICE_SELECTS.forEach(id => {
            // Apply uniqueness check ONLY if Versatile is NOT equipped
            const isUnique = !loadoutState.isVersatile;
            applyDropdownRestriction(id, allowedDeviceIds, isUnique, loadoutState.devices);
        });

        // --- 4. Weapon Availability and Uniqueness ---
        const allWeaponIds = Object.values(allData.Weapons).map(String);
        
        // These are the weapons that are RESTRICTED from Primary/Secondary slots.
        const backupExclusiveIds = WEAPON_BACKUP_DEFAULT_IDS.filter(id => id !== "23"); // All default backup weapons EXCEPT Fists
        const heavyWeaponIds = WEAPON_HEAVY_IDS; 
        
        // Weapons available in Primary/Secondary slots
        let primarySecondaryAllowedIds = allWeaponIds.filter(id => {
            const isBackupDefault = backupExclusiveIds.includes(id);
            const isHeavy = heavyWeaponIds.includes(id);
            
            // 1. Block backup-default (non-Fists) weapons
            if (isBackupDefault) return false;
            
            // 2. Block heavy weapons unless Heavy Weapons augment is equipped
            if (isHeavy && !loadoutState.isHeavyWeapons) return false;
            
            return true;
        });
        
        // All weapons must be unique (Versatile no longer affects weapon uniqueness)
        const selectedWeaponsExcludingCurrent = (currentId) => loadoutState.weapons.all.filter(val => val !== currentId);
        
        // Primary Slot
        applyDropdownRestriction('primary-weapon-select', primarySecondaryAllowedIds, true, selectedWeaponsExcludingCurrent(loadoutState.weapons.primary));
        
        // Secondary Slot
        applyDropdownRestriction('secondary-weapon-select', primarySecondaryAllowedIds, true, selectedWeaponsExcludingCurrent(loadoutState.weapons.secondary));

        // Backup Slot (Has its own complex rules)
        let backupAllowedIds = [];
        if (loadoutState.isHeavyWeapons) {
            // RULE: Heavy Weapons Augment is ON -> Heavy Weapons + Fists
            backupAllowedIds = [...WEAPON_HEAVY_IDS, "23"]; 
        } else {
            // RULE: Heavy Weapons Augment is OFF -> Default Backup List
            backupAllowedIds = WEAPON_BACKUP_DEFAULT_IDS;
        }
        
        // Note: Backup slot still respects overall uniqueness (e.g., if Fists is in Backup, it can't be in Primary).
        applyDropdownRestriction('backup-weapon-select', backupAllowedIds, true, selectedWeaponsExcludingCurrent(loadoutState.weapons.backup));
    }


    /**
     * Applies Ammo restrictions based on Weapon and Technician Augment. (Logic from previous step, kept for completeness)
     */
    function applyAmmoRestrictions() {
        
        function updateAmmoSlot(weaponSelectId, ammoSelectId) {
            const weaponId = document.getElementById(weaponSelectId)?.value;
            const ammoSelect = document.getElementById(ammoSelectId);
            if (!ammoSelect || !weaponId) return;

            let allowedAmmoIds = new Set();
            const currentAmmoValue = ammoSelect.value;
            
            if (weaponId === WEAPON_WARRANT) {
                allowedAmmoIds = new Set(WARRANT_DEFAULT_AMMO_IDS);
                if (loadoutState.isTechnician) {
                    allowedAmmoIds.add(WARRANT_TECHNICIAN_AMMO_ID);
                }
            } else {
                allowedAmmoIds = new Set(DEFAULT_GENERAL_AMMO_IDS);
                
                if (loadoutState.isTechnician) {
                    const excludedGrenades = [...WARRANT_DEFAULT_AMMO_IDS, WARRANT_TECHNICIAN_AMMO_ID];
                    Object.values(allData.Ammo).forEach(id => {
                        if (!excludedGrenades.includes(String(id))) {
                             allowedAmmoIds.add(String(id));
                        }
                    });
                }
            }
            
            // Apply restrictions to the dropdown
            Array.from(ammoSelect.options).forEach(option => {
                if (option.value === "") { 
                    option.disabled = false;
                } else {
                    const isAllowed = allowedAmmoIds.has(option.value);
                    option.disabled = !isAllowed;
                    
                    if (!isAllowed && option.value === currentAmmoValue) {
                        ammoSelect.value = "";
                    }
                }
            });
        }
        
        updateAmmoSlot('secondary-weapon-select', 'secondary-ammo-select');
        updateAmmoSlot('primary-weapon-select', 'primary-ammo-select');
    }

    /**
     * Changes slot names based on equipped augments. (Logic from previous step, kept for completeness)
     */
    function updateLabels() {
        // Rename Backup slot to Heavy if Heavy Weapons is equipped
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
        applyAvailabilityAndUniquenessRestrictions();
        applyAmmoRestrictions();
        updateLabels();
    }

    /**
     * Initial setup and event listeners.
     */
    async function initializeEditor() {
        const data = await fetchLoadoutData();
        if (!data) return; 
        
        allData = data; 

        // --- Initial Population using fetched data ---
        populateSelect('shell-select', data.Shells);
        
        AUGMENT_SELECTS.forEach(id => populateSelect(id, data.Augments));
        DEVICE_SELECTS.forEach(id => populateSelect(id, data.Devices));
        
        populateSelect('backup-weapon-select', data.Weapons);
        populateSelect('secondary-weapon-select', data.Weapons);
        populateSelect('primary-weapon-select', data.Weapons);

        // Attachments
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
        handleLoadoutChange();
    }

    initializeEditor();
});