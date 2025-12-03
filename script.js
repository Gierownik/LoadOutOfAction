document.addEventListener('DOMContentLoaded', () => {
    // Function to fetch and parse the JSON file
    async function fetchLoadoutData() {
        try {
            const response = await fetch('id.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Could not fetch loadout data:", error);
            // Optionally, display an error message on the page
            return null;
        }
    }

    // Function to populate a <select> element
    function populateSelect(selectElementId, dataObject) {
        const select = document.getElementById(selectElementId);
        if (!select) return;

        // Add a default "None/Select" option
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = `-- Select ${selectElementId.split('-')[0]} --`;
        select.appendChild(defaultOption);

        // Populate with options from the data object
        // We use Object.keys().sort() to display them alphabetically by name
        const sortedKeys = Object.keys(dataObject).sort();
        sortedKeys.forEach(name => {
            const option = document.createElement('option');
            // The value can be the ID from your JSON, but the text is the name
            option.value = dataObject[name];
            option.textContent = name;
            select.appendChild(option);
        });
    }

    // Main function to initialize the editor
    async function initializeEditor() {
        const data = await fetchLoadoutData();
        if (!data) return;

        // --- Core and Augments ---
        populateSelect('shell-select', data.Shells);
        
        // Populate all 4 augment slots
        for (let i = 1; i <= 4; i++) {
            populateSelect(`augment-${i}-select`, data.Augments);
        }
        
        // Populate all 2 device slots
        populateSelect('device-1-select', data.Devices);
        populateSelect('device-2-select', data.Devices);

        // --- Weapons and Attachments ---

        // Backup (Unmoddable) Weapon
        populateSelect('backup-weapon-select', data.Weapons);

        // Secondary Weapon
        populateSelect('secondary-weapon-select', data.Weapons);
        populateSelect('secondary-optic-select', data.Optics);
        populateSelect('secondary-ammo-select', data.Ammo);
        for (let i = 1; i <= 4; i++) {
            populateSelect(`secondary-mod-${i}-select`, data.Mods);
        }

        // Primary Weapon
        populateSelect('primary-weapon-select', data.Weapons);
        populateSelect('primary-optic-select', data.Optics);
        populateSelect('primary-ammo-select', data.Ammo);
        for (let i = 1; i <= 4; i++) {
            populateSelect(`primary-mod-${i}-select`, data.Mods);
        }
        
        // Note: For a fully functional editor, you would add event listeners here
        // to handle user selection, check for compatibility, and manage unique selections
        // (e.g., preventing the same augment from being selected twice).
    }

    initializeEditor();
});