document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL CONSTANTS & DATA STORAGE ---
    
    // IDs for logic checks (Values come from the id.json file)
    const AUGMENT_TECHNICIAN = "23";      // Unlocks technician-only attachments
    const AUGMENT_VERSATILE = "61";       // Allows duplicate devices, but NOT weapons (new logic)
    const AUGMENT_HEAVY_WEAPONS = "19";   // Renames backup slot and allows heavy weapons
    const AUGMENT_EXPERIMENTAL = "17";    // Required for experimental devices
    const AUGMENT_NEUROHACKER = "68";     // Placeholder ID for Neurohacker (assumed next ID)
    const AUGMENT_PROFESSIONAL = "50";    // replace with actual ID
    const AUGMENT_STUDIED = "76";         // replace with actual ID

    // Device Names requiring Neurohacker (since IDs are unavailable)
    const DEVICE_LOCKDOWN_NAME = "Lockdown";
    const DEVICE_CASCADE_NAME = "Cascade";
    const DEVICE_PATHOGEN_NAME = "Pathogen";
    
    let allAmmoData = {};       // Stores all Ammo data fetched from JSON
    let allWeaponsData = {};    // Stores Weapon ID: Name map (from id.json)
    let allDevicesData = [];    // Stores array of device objects (from devices.json)
    let allAttachmentsData = [];// Stores array of attachment objects (from attachments.json)

    // Hardcoded weapon category map (ID to Type)
    const WEAPON_CATEGORIES = {
        "2":"secondary", // Major
        "3":"secondary", // Deckard
        "7":"primary",   // Icarus
        "6":"primary",   // Master-Key
        "5":"secondary", // Cerberus
        "9":"primary",   // Vigil
        "1":"backup",    // TTK
        "8":"primary",   // Custodian
        "4":"secondary", // Geist
        "10":"primary",  // Inhibitor
        "11":"primary",  // Sentinel
        "12":"primary",  // Warrant
        "13":"primary",  // Helix
        "14":"primary",  // Nexus
        "15":"heavy",    // Umibozu
        "16":"heavy",    // Blackout
        "17":"backup",   // Akanami
        "18":"primary",  // Typhon
        "19":"secondary",// Omen
        "20":"heavy",    // Hole-Punch
        "21":"secondary",// Double-Tap
        "22":"backup",   // Dusters
        "23":"backup"    // Fists
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
        isProfessional: false,
        isStudied: false
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

        const items = Array.isArray(dataMap)
            ? dataMap
            : Object.entries(dataMap).map(([name, id]) => ({ id, name }));

        items.sort((a, b) => a.name.localeCompare(b.name));

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;   // 👈 always use ID
            option.textContent = item.name;
            if (item.id === currentValue) option.selected = true;
            select.appendChild(option);
        });
    }

    // Populate weapon selects with category filtering and slot renaming
    function populateWeaponSelect(selectId, allWeaponsMap, weaponCategories, isHeavyWeaponsAugment) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">--- Select Weapon ---</option>';

        let allowedCategories = [];
        let slotName = '';

        // Base slot defaults
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
        } else {
            return;
        }

        // Augment rules
        if (loadoutState.isVersatile && (selectId === 'primary-weapon-select' || selectId === 'secondary-weapon-select')) {
            allowedCategories = ['primary', 'secondary', 'backup'];
        }

        // Studied removes primary and secondary everywhere
        if (loadoutState.isStudied) {
            allowedCategories = allowedCategories.filter(c => c !== 'primary' && c !== 'secondary');
        } else {
            // Professional removes primary everywhere
            if (loadoutState.isProfessional) {
                allowedCategories = allowedCategories.filter(c => c !== 'primary');
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

        // If prior selection is no longer allowed, clear it
        if (currentValue && !select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = "";
        }
    }

    /**
     * Filter and populate attachment selects based on augments and weapon compatibility.
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
            const isCompatible = attachment.compatibility.includes(weaponName);
            
            let shouldShow = true;
            if (isTechnicianRequired && !loadoutState.isTechnician) shouldShow = false;
            if (!isCompatible) shouldShow = false;

            if (shouldShow) {
                const option = document.createElement('option');
                option.value = attachment.name;
                option.textContent = attachment.name;
                if (attachment.name === currentValue) option.selected = true;
                select.appendChild(option);
            }
        });

        // Clear invalid selection after filtering
        if (currentValue && !select.querySelector(`option[value="${currentValue}"]`)) {
             select.value = "";
        }
    }

    // --- DATA LOADING & POPULATION ---

    async function fetchLoadoutData() {
        try {
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
            
            // Weapon ID: Name map
            if (idData.Weapons) {
                 for (const [name, id] of Object.entries(idData.Weapons)) {
                     allWeaponsData[id] = name; // {ID: Name}
                 }
            } else {
                const placeholderWeapons = { "1": "Major", "2": "Deckard", "3": "Geist", "4": "Cerberus", "5": "Master-Key", "6": "Icarus", "7": "Custodian", "8": "Vigil", "9": "Inhibitor", "10": "Sentinel", "11": "Helix", "12": "Warrant" };
                for (const [id, name] of Object.entries(placeholderWeapons)) { allWeaponsData[id] = name; }
            }

            return { ...idData, Devices: allDevicesData };

        } catch (error) {
            console.error("Could not fetch loadout data. Please ensure all JSON files are in the root directory.", error);
            alert("Error loading loadout data. Check the browser console for details.");
            return null;
        }
    }
    
    async function fetchAndPopulateData() {
        const data = await fetchLoadoutData();
        if (!data) return; 

        // Store Ammo data for restriction checks
        allAmmoData = data.Ammo; 

        // Initial population
        populateSelect('shell-select', data.Shells);
        AUGMENT_SELECTS.forEach(id => populateSelect(id, data.Augments));
        populateSelect('device-1-select', allDevicesData);
        populateSelect('device-2-select', allDevicesData);

        updateLoadoutState();
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);
        populateWeaponSelect('secondary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);
        populateWeaponSelect('primary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);

        populateSelect('secondary-optic-select', data.Optics);
        populateSelect('secondary-ammo-select', data.Ammo);
        SECONDARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));

        populateSelect('primary-optic-select', data.Optics);
        populateSelect('primary-ammo-select', data.Ammo);
        PRIMARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));
        
        // Listeners
        const allSelects = document.querySelectorAll('.container select');
        allSelects.forEach(select => {
            select.addEventListener('change', handleLoadoutChange);
        });

        // Apply once
        updateLoadoutState();
        applyLoadoutRestrictions();

        // Reflect current state in Loadout Code (added below)
        updateLoadoutCode();
    }

    // --- LOGIC & RESTRICTIONS ---

    function updateLoadoutState() {
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

        loadoutState.isTechnician = loadoutState.augments.includes(AUGMENT_TECHNICIAN);
        loadoutState.isVersatile = loadoutState.augments.includes(AUGMENT_VERSATILE);
        loadoutState.isHeavyWeapons = loadoutState.augments.includes(AUGMENT_HEAVY_WEAPONS);
        loadoutState.isExperimental = loadoutState.augments.includes(AUGMENT_EXPERIMENTAL);
        loadoutState.isNeurohacker = loadoutState.augments.includes(AUGMENT_NEUROHACKER);
        loadoutState.isProfessional = loadoutState.augments.includes(AUGMENT_PROFESSIONAL);
        loadoutState.isStudied = loadoutState.augments.includes(AUGMENT_STUDIED);
    }
    
    function applyLoadoutRestrictions() {
        updateLoadoutState();

        // Rebuild all weapon selects based on augments
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState.isHeavyWeapons);
        populateWeaponSelect('secondary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState.isHeavyWeapons);
        populateWeaponSelect('primary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState.isHeavyWeapons);

        // Weapon uniqueness enforcement (no duplicates across slots)
        WEAPON_SELECTS.forEach(currentSelectId => {
            const currentSelect = document.getElementById(currentSelectId);
            const currentValue = currentSelect?.value;
            if (!currentValue) return;

            const otherSelectedWeapons = loadoutState.weapons.all.filter(id => id && id !== currentValue);
            const isDuplicate = otherSelectedWeapons.includes(currentValue);

            Array.from(currentSelect.options).forEach(option => {
                if (option.value && option.value !== currentValue) {
                    const otherWeapons = loadoutState.weapons.all.filter(id => id !== option.value && id);
                    const shouldDisable = otherWeapons.includes(option.value);
                    option.disabled = shouldDisable;
                    option.title = shouldDisable ? 'Cannot equip multiple of the same weapon.' : '';
                }
            });
            
            if (isDuplicate) currentSelect.classList.add('invalid-selection');
            else currentSelect.classList.remove('invalid-selection');
        });

        // Mod uniqueness
        function applyModRestrictions(modSelectIds) {
            const selectedMods = modSelectIds
                .map(id => document.getElementById(id)?.value)
                .filter(val => val);

            modSelectIds.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (!select) return;
                const currentValue = select.value;

                Array.from(select.options).forEach(option => {
                    if (!option.value) return; // skip placeholder
                    const isSelectedElsewhere = selectedMods.includes(option.value) && option.value !== currentValue;
                    option.disabled = isSelectedElsewhere;
                    option.title = isSelectedElsewhere ? "Already equipped in another mod slot." : "";
                });

                const duplicates = selectedMods.filter(val => val === currentValue);
                if (duplicates.length > 1) select.classList.add("invalid-selection");
                else select.classList.remove("invalid-selection");
            });
        }
        applyModRestrictions(SECONDARY_MOD_SELECTS);
        applyModRestrictions(PRIMARY_MOD_SELECTS);

        // Augment uniqueness
        AUGMENT_SELECTS.forEach(selectId => {
            const select = document.getElementById(selectId);
            const currentValue = select.value;

            Array.from(select.options).forEach(option => {
                const augmentId = option.value;

                const otherAugments = AUGMENT_SELECTS
                    .filter(id => id !== selectId)
                    .map(id => document.getElementById(id)?.value)
                    .filter(val => val);

                const alreadySelected = otherAugments.includes(augmentId);

                if (augmentId !== currentValue) {
                    option.disabled = alreadySelected;
                    option.title = alreadySelected ? 'Already equipped in another slot.' : '';
                }

                if (augmentId === currentValue && alreadySelected) {
                    select.classList.add('invalid-selection');
                } else if (augmentId === currentValue) {
                    select.classList.remove('invalid-selection');
                }
            });
        });

        // Device rules (requirements + uniqueness unless Versatile)
        DEVICE_SELECTS.forEach(selectId => {
            const select = document.getElementById(selectId);
            const currentValue = select.value;
            if (!select) return;

            const otherDeviceValues = DEVICE_SELECTS
                .filter(id => id !== selectId)
                .map(id => document.getElementById(id)?.value)
                .filter(val => val);

            Array.from(select.options).forEach(option => {
                const deviceName = option.textContent;

                const requiresNeurohacker = [DEVICE_LOCKDOWN_NAME, DEVICE_CASCADE_NAME, DEVICE_PATHOGEN_NAME].includes(deviceName);
                const requiresExperimental = allDevicesData.some(d => d.name === deviceName && d.experimental === "true");

                let shouldDisable = false;
                let restrictionReason = '';

                if (requiresNeurohacker && !loadoutState.isNeurohacker) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Neurohacker Augment.';
                } else if (requiresExperimental && !loadoutState.isExperimental) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Experimental Augment.';
                }

                const isDuplicate = otherDeviceValues.includes(option.value);
                if (isDuplicate && !loadoutState.isVersatile) {
                    shouldDisable = true;
                    restrictionReason = 'Already Equipped in another slot.';
                }

                if (loadoutState.isStudied) {
                    const allowedStudiedDevices = ["Bolster", "Overcharge", "Shroud", "Reserve Stim"];
                    const isAllowedByStudied = allowedStudiedDevices.includes(deviceName);
                    if (!isAllowedByStudied) {
                        shouldDisable = true;
                        restrictionReason = 'Studied restricts devices to Bolster, Overcharge, Shroud, Reserve Stim.';
                    }
                }

                if (option.value !== currentValue) {
                    option.disabled = shouldDisable;
                    option.title = shouldDisable ? restrictionReason : '';
                }

                if (option.value === currentValue && shouldDisable) {
                    select.classList.add('invalid-selection');
                } else if (option.value === currentValue) {
                    select.classList.remove('invalid-selection');
                }
            });
        });

        // Attachment compatibility
        const secondaryWeaponName = allWeaponsData[loadoutState.weapons.secondary];
        const primaryWeaponName = allWeaponsData[loadoutState.weapons.primary];

        applyAttachmentRestrictions('secondary-optic-select', secondaryWeaponName, 'Optic');
        applyAttachmentRestrictions('secondary-ammo-select', secondaryWeaponName, 'Ammo');
        SECONDARY_MOD_SELECTS.forEach(id => applyAttachmentRestrictions(id, secondaryWeaponName, 'Mod'));

        applyAttachmentRestrictions('primary-optic-select', primaryWeaponName, 'Optic');
        applyAttachmentRestrictions('primary-ammo-select', primaryWeaponName, 'Ammo');
        PRIMARY_MOD_SELECTS.forEach(id => applyAttachmentRestrictions(id, primaryWeaponName, 'Mod'));
    }
    
    function handleLoadoutChange(event) {
        document.querySelectorAll('.invalid-selection').forEach(el => el.classList.remove('invalid-selection'));
        applyLoadoutRestrictions();
        updateLoadoutCode(); // keep the code in sync
    }
    
    // --- INITIALIZATION ---
    fetchAndPopulateData();


    // =======================
    // === LOADOUT CODE SYSTEM (compact binary Base64)
    // =======================

    // Insert a Loadout Code field dynamically
    // Insert Loadout Code field
    (function insertLoadoutCodeField() {
        const container = document.querySelector('.container') || document.body;
        const wrapper = document.createElement('div');
        wrapper.className = 'loadout-code-container';
        wrapper.style.textAlign = 'center';
        wrapper.style.margin = '20px 0';

        const label = document.createElement('label');
        label.setAttribute('for', 'loadout-code');
        label.textContent = 'Loadout Code:';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'loadout-code';
        input.style.width = '60%';
        input.style.padding = '8px';

        wrapper.appendChild(label);
        wrapper.appendChild(document.createTextNode(' '));
        wrapper.appendChild(input);

        container.appendChild(wrapper);

        input.addEventListener('change', (e) => {
            populateFromCode(e.target.value.trim());
        });
    })();

    // Keep code updated on any change
    document.querySelector('.container').addEventListener('change', updateLoadoutCode);


    // Helpers: safe parsing and packing
    function toByte(valStr) {
        const n = parseInt(valStr || "0", 10);
        return isNaN(n) ? 0 : Math.max(0, Math.min(255, n));
    }
    function fromTwoBytes(hi, lo) {
        return ((hi & 0xFF) << 8) + (lo & 0xFF);
    }

    // Build compact bytes from current selections
    function buildLoadoutBytes() {
        const shell = toByte(document.getElementById('shell-select')?.value);
        const backup = toByte(document.getElementById('backup-weapon-select')?.value);
        const secondary = toByte(document.getElementById('secondary-weapon-select')?.value);
        const primary = toByte(document.getElementById('primary-weapon-select')?.value);

        const sidearmFields = [
            document.getElementById('secondary-optic-select')?.value,
            document.getElementById('secondary-ammo-select')?.value,
            ...SECONDARY_MOD_SELECTS.map(id => document.getElementById(id)?.value)
        ].map(toByte);

        const primaryFields = [
            document.getElementById('primary-optic-select')?.value,
            document.getElementById('primary-ammo-select')?.value,
            ...PRIMARY_MOD_SELECTS.map(id => document.getElementById(id)?.value)
        ].map(toByte);

        const augmentBytes = AUGMENT_SELECTS.map(id => toByte(document.getElementById(id)?.value));
        const devices = DEVICE_SELECTS.map(id => toByte(document.getElementById(id)?.value));

        const bytes = [
            shell,
            backup, secondary, primary,
            ...sidearmFields,
            ...primaryFields,
            ...augmentBytes,
            ...devices
        ];
        return new Uint8Array(bytes); // 24 bytes total
    }

    // Convert bytes <-> Base64 safely
    function bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToBytes(b64) {
        try {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        } catch {
            alert("Invalid Loadout Code");
            return null;
        }
    }


    // Update the Loadout Code input value
    function updateLoadoutCode() {
        const field = document.getElementById('loadout-code');
        if (!field) return;
        const bytes = buildLoadoutBytes();
        field.value = bytesToBase64(bytes); // always 32 chars
    }

    function populateFromCode(b64) {
        const bytes = base64ToBytes(b64);
        if (!bytes || bytes.length !== 24) {
            alert("Invalid Loadout Code length");
            return;
        }
        let i = 0;
        const shell = bytes[i++];
        const backup = bytes[i++];
        const secondary = bytes[i++];
        const primary = bytes[i++];
        const sidearmAttachments = bytes.slice(i, i+6); i += 6;
        const primaryAttachments = bytes.slice(i, i+6); i += 6;
        const augments = bytes.slice(i, i+4); i += 4;
        const devices = bytes.slice(i, i+2); i += 2;

        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };

        setVal('shell-select', shell);
        setVal('backup-weapon-select', backup);
        setVal('secondary-weapon-select', secondary);
        setVal('primary-weapon-select', primary);

        setVal('secondary-optic-select', sidearmAttachments[0]);
        setVal('secondary-ammo-select', sidearmAttachments[1]);
        SECONDARY_MOD_SELECTS.forEach((id, idx) => setVal(id, sidearmAttachments[idx+2]));

        setVal('primary-optic-select', primaryAttachments[0]);
        setVal('primary-ammo-select', primaryAttachments[1]);
        PRIMARY_MOD_SELECTS.forEach((id, idx) => setVal(id, primaryAttachments[idx+2]));

        AUGMENT_SELECTS.forEach((id, idx) => setVal(id, augments[idx]));
        DEVICE_SELECTS.forEach((id, idx) => setVal(id, devices[idx]));

        applyLoadoutRestrictions();
        updateLoadoutCode();
    }


    // Also update code when anything in the container changes
    (function mirrorChangesToCode() {
        const container = document.querySelector('.container') || document.body;
        container.addEventListener('change', () => {
            updateLoadoutCode();
        });
    })();

});
