document.addEventListener('DOMContentLoaded', () => {

    // Augment IDs for logic checks (These values come from the id.json file)
    const AUGMENT_VERSATILE = "61"; // Allows duplicate weapons/devices
    const AUGMENT_HEAVY_WEAPONS = "19"; // Renames backup slot

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
        weapons: [],
        modsSecondary: [],
        modsPrimary: [],
        isVersatile: false,
        isHeavyWeapons: false
    };

    /**
     * Function to fetch and parse the JSON file from the same directory.
     */
    async function fetchLoadoutData() {
        try {
            const response = await fetch('id.json');
            if (!response.ok) {
                // Throw error if the file is not found or cannot be read
                throw new Error(`HTTP error! Status: ${response.status}. Ensure id.json is in the root directory.`);
            }
            return await response.json();
        } catch (error) {
            console.error("Could not fetch loadout data. Please ensure your web server is running and 'id.json' exists.", error);
            // Alert the user if the data fails to load
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

        // Clear existing options
        select.innerHTML = ''; 

        // Add a default "None/Select" option
        const defaultOption = document.createElement('option');
        defaultOption.value = ""; // Empty string value for "None/Select"
        defaultOption.textContent = defaultTextOverride || `-- Select ${selectElementId.split('-')[0]} --`;
        select.appendChild(defaultOption);

        // Populate with options from the data object
        const sortedKeys = Object.keys(dataObject).sort();
        sortedKeys.forEach(name => {
            const option = document.createElement('option');
            // Value is the ID (as a string), text is the name
            option.value = String(dataObject[name]); 
            option.textContent = name;
            select.appendChild(option);
        });
    }

    /**
     * Collects the current state of the loadout from all dropdowns.
     */
    function updateLoadoutState() {
        // Collects selected values, filtering out empty strings and null/undefined values
        const getValues = (ids) => ids.map(id => document.getElementById(id)?.value).filter(val => val);
        
        loadoutState.augments = getValues(AUGMENT_SELECTS);
        loadoutState.devices = getValues(DEVICE_SELECTS);
        loadoutState.weapons = getValues(WEAPON_SELECTS);
        loadoutState.modsSecondary = getValues(SECONDARY_MOD_SELECTS);
        loadoutState.modsPrimary = getValues(PRIMARY_MOD_SELECTS);

        // Check for special augments
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isHeavyWeapons = loadoutState.augments.includes(AUGMENT_HEAVY_WEAPONS);
    }

    /**
     * Applies restrictions to dropdown options based on the current loadoutState.
     */
    function applyRestrictions() {
        
        // --- 1 & 3: Augment Uniqueness ---
        const selectedAugments = loadoutState.augments;
        AUGMENT_SELECTS.forEach(currentSelectId => {
            const currentSelect = document.getElementById(currentSelectId);
            const currentValue = currentSelect.value;
            
            Array.from(currentSelect.options).forEach(option => {
                // 1. Always keep the selected value or default value enabled
                if (option.value === currentValue || option.value === "") {
                    option.disabled = false;
                    return;
                }
                
                // 2. Disable if selected in another slot
                option.disabled = selectedAugments.includes(option.value);
            });
        });

        // --- 4: Mod Uniqueness (Per Weapon) ---
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
        
        // --- 1: Weapon/Device Uniqueness (Conditional with Versatile) ---
        const allowDuplicates = loadoutState.isVersatile;

        // Function to handle weapon/device uniqueness
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
                        // Count how many times this option is selected *in all slots*
                        const selectedCount = selectedValues.filter(val => val === option.value).length;
                        
                        // If the item is already selected once, disable it
                        option.disabled = selectedCount > 0;
                    } else {
                        // If Versatile is equipped, enable everything
                        option.disabled = false;
                    }
                });
            });
        }
        
        applyUniquenessCheck(WEAPON_SELECTS, loadoutState.weapons);
        applyUniquenessCheck(DEVICE_SELECTS, loadoutState.devices);
    }
    
    /**
     * Changes slot names based on equipped augments.
     */
    function updateLabels() {
        // --- 2: Rename Backup slot to Heavy ---
        const label = document.querySelector('label[for="backup-weapon-select"]');
        if (label) {
            if (loadoutState.isHeavyWeapons) {
                label.textContent = "Heavy:";
            } else {
                label.textContent = "Backup:";
            }
        }
    }

    /**
     * Main handler that runs on any loadout change.
     */
    function handleLoadoutChange() {
        updateLoadoutState();
        applyRestrictions();
        updateLabels();
    }

    /**
     * Initial setup and event listeners.
     */
    async function initializeEditor() {
        const data = await fetchLoadoutData();
        if (!data) return; // Stop if data fetch failed
        
        // --- Initial Population using fetched data ---
        populateSelect('shell-select', data.Shells);
        
        AUGMENT_SELECTS.forEach(id => populateSelect(id, data.Augments));
        DEVICE_SELECTS.forEach(id => populateSelect(id, data.Devices));
        
        populateSelect('backup-weapon-select', data.Weapons);
        populateSelect('secondary-weapon-select', data.Weapons);
        populateSelect('primary-weapon-select', data.Weapons);

        populateSelect('secondary-optic-select', data.Optics);
        populateSelect('secondary-ammo-select', data.Ammo);
        SECONDARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));

        populateSelect('primary-optic-select', data.Optics);
        populateSelect('primary-ammo-select', data.Ammo);
        PRIMARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));
        
        // --- Add Event Listeners ---
        // Target all <select> elements in the container
        const allSelects = document.querySelectorAll('.container select');
        allSelects.forEach(select => {
            select.addEventListener('change', handleLoadoutChange);
        });

        // Run once on startup to ensure initial state is correct
        handleLoadoutChange();
    }

    initializeEditor();
});