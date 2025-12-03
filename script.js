document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & DATA STORAGE ---
    
    // IDs for logic checks (Values come from the id.json file)
    const AUGMENT_TECHNICIAN = "23";      // Unlocks all general ammo + Incendiary Grenade for Warrant
    const AUGMENT_VERSATILE = "61";       // Allows duplicate weapons/devices
    const AUGMENT_HEAVY_WEAPONS = "19";   // Renames backup slot
    const WEAPON_WARRANT = "12";          // Special ammo rules apply
    
    // Ammo ID Lists (based on id.json)
    const DEFAULT_GENERAL_AMMO_IDS = ["21", "20", "19", "26", "35"]; // Shred, Heavy, Piercing, Standard, TD Ammo
    const WARRANT_DEFAULT_AMMO_IDS = ["38", "39", "41"];             // Standard, Impact, Proximity Grenade
    const WARRANT_TECHNICIAN_AMMO_ID = "40";                         // Incendiary Grenade
    
    let allAmmoData = {}; // Stores all Ammo data fetched from JSON
    
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
            secondary: "", 
            primary: "",
        },
        modsSecondary: [],
        modsPrimary: [],
        isTechnician: false,
        isVersatile: false,
        isHeavyWeapons: false
    };

    // --- DATA LOADING & POPULATION ---

    /**
     * Function to fetch and parse the JSON file from the same directory.
     */
    async function fetchLoadoutData() {
        try {
            const response = await fetch('id.json');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}. Ensure id.json is in the root directory.`);
            }
            return await response.json();
        } catch (error) {
            console.error("Could not fetch loadout data. Please ensure your web server is running and 'id.json' exists.", error);
            alert("Error loading loadout data. Check the browser console for details.");
            return null;
        }
    }

    /**
     * Helper function to populate a <select> element.
     */
    function populateSelect(selectElementId, dataObject, defaultTextOverride) {
        const select = document.getElementById(selectElementId);
        if (!select) return;

        select.innerHTML = ''; 

        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = defaultTextOverride || `-- Select ${selectElementId.split('-')[0]} --`;
        select.appendChild(defaultOption);

        const sortedKeys = Object.keys(dataObject).sort();
        sortedKeys.forEach(name => {
            const option = document.createElement('option');
            option.value = String(dataObject[name]); 
            option.textContent = name;
            select.appendChild(option);
        });
    }

    // --- STATE MANAGEMENT ---

    /**
     * Collects the current state of the loadout from all dropdowns.
     */
    function updateLoadoutState() {
        const getValues = (ids) => ids.map(id => document.getElementById(id)?.value).filter(val => val);
        
        loadoutState.augments = getValues(AUGMENT_SELECTS);
        loadoutState.devices = getValues(DEVICE_SELECTS);
        
        // Note: Backup is unmoddable, so only Primary/Secondary influence ammo/mod restrictions
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
    }

    // --- RESTRICTION LOGIC ---
    
    /**
     * Applies new Ammo restrictions based on Weapon and Technician Augment.
     */
    function applyAmmoRestrictions() {
        
        function updateAmmoSlot(weaponSelectId, ammoSelectId) {
            const weaponId = document.getElementById(weaponSelectId)?.value;
            const ammoSelect = document.getElementById(ammoSelectId);
            if (!ammoSelect || !weaponId) return;

            let allowedAmmoIds = new Set();
            const currentAmmoValue = ammoSelect.value;
            
            if (weaponId === WEAPON_WARRANT) {
                // RULE 3: Warrant Weapon Restriction
                allowedAmmoIds = new Set(WARRANT_DEFAULT_AMMO_IDS);
                
                // RULE 4: Warrant + Technician
                if (loadoutState.isTechnician) {
                    allowedAmmoIds.add(WARRANT_TECHNICIAN_AMMO_ID);
                }
            } else {
                // RULE 1: Default Ammo Restriction
                allowedAmmoIds = new Set(DEFAULT_GENERAL_AMMO_IDS);
                
                // RULE 2: Technician Override (General)
                if (loadoutState.isTechnician) {
                    // Add ALL ammo IDs if Technician is equipped (excluding Warrant-specific grenades)
                    Object.values(allAmmoData).forEach(id => {
                        // Prevent adding grenade IDs 38, 39, 41, 40 to general pool
                        if (![...WARRANT_DEFAULT_AMMO_IDS, WARRANT_TECHNICIAN_AMMO_ID].includes(String(id))) {
                             allowedAmmoIds.add(String(id));
                        }
                    });
                }
            }
            
            // Apply restrictions to the dropdown
            Array.from(ammoSelect.options).forEach(option => {
                if (option.value === "") { // Keep 'Select Ammo' option enabled
                    option.disabled = false;
                } else {
                    const isAllowed = allowedAmmoIds.has(option.value);
                    option.disabled = !isAllowed;
                    
                    // If the currently selected ammo is now disabled, clear the selection
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
     * Applies restrictions to dropdown options based on the current loadoutState.
     */
    function applyRestrictions() {
        
        // 1. Augment Uniqueness
        const selectedAugments = loadoutState.augments;
        AUGMENT_SELECTS.forEach(currentSelectId => {
            const currentSelect = document.getElementById(currentSelectId);
            const currentValue = currentSelect.value;
            
            Array.from(currentSelect.options).forEach(option => {
                if (option.value === currentValue || option.value === "") {
                    option.disabled = false;
                    return;
                }
                option.disabled = selectedAugments.includes(option.value);
            });
        });

        // 2. Mod Uniqueness (Per Weapon)
        function applyModUniqueness(modSelects, selectedMods) {
            modSelects.forEach(currentSelectId => {
                const currentSelect = document.getElementById(currentSelectId);
                const currentValue = currentSelect.value;
                
                Array.from(currentSelect.options).forEach(option => {
                    if (option.value === currentValue || option.value === "") {
                        option.disabled = false;
                        return;
                    }
                    option.disabled = selectedMods.includes(option.value);
                });
            });
        }
        applyModUniqueness(SECONDARY_MOD_SELECTS, loadoutState.modsSecondary);
        applyModUniqueness(PRIMARY_MOD_SELECTS, loadoutState.modsPrimary);
        
        // 3. Weapon/Device Uniqueness (Conditional with Versatile)
        const allowDuplicates = loadoutState.isVersatile;

        function applyUniquenessCheck(selectIds, selectedValues) {
            selectIds.forEach(currentSelectId => {
                const currentSelect = document.getElementById(currentSelectId);
                const currentValue = currentSelect.value;

                Array.from(currentSelect.options).forEach(option => {
                    if (option.value === currentValue || option.value === "") {
                        option.disabled = false;
                        return;
                    }
                    
                    if (!allowDuplicates) {
                        const selectedCount = selectedValues.filter(val => val === option.value).length;
                        option.disabled = selectedCount > 0;
                    } else {
                        option.disabled = false;
                    }
                });
            });
        }
        
        applyUniquenessCheck(WEAPON_SELECTS, loadoutState.weapons.all);
        applyUniquenessCheck(DEVICE_SELECTS, loadoutState.devices);
    }
    
    /**
     * Changes slot names based on equipped augments.
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
        applyRestrictions();
        applyAmmoRestrictions(); // New logic call
        updateLabels();
    }

    /**
     * Initial setup and event listeners.
     */
    async function initializeEditor() {
        const data = await fetchLoadoutData();
        if (!data) return; 
        
        // Store Ammo data for restriction checks
        allAmmoData = data.Ammo; 

        // --- Initial Population using fetched data ---
        populateSelect('shell-select', data.Shells);
        
        AUGMENT_SELECTS.forEach(id => populateSelect(id, data.Augments));
        DEVICE_SELECTS.forEach(id => populateSelect(id, data.Devices));
        
        // Weapons (Backup is unmoddable, but Primary/Secondary need all mods/ammo)
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