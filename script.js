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
    let idDataGlobal = {};      // Raw id.json data for id -> name and name -> id lookups
    let reverseIdMaps = {};     // Reverse maps: category -> { id: name }
    // Technician-only ammo IDs (populated after loading attachments/id.json)
    let TECHNICIAN_ONLY_AMMO_IDS = [];

    // Loop handle for continuous technician ammo availability check
    let technicianAmmoCheckInterval = null;

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
        // Versatile: primary & secondary slots can equip backup, secondary, primary
        if (loadoutState.isVersatile && (selectId === 'primary-weapon-select' || selectId === 'secondary-weapon-select')) {
            allowedCategories = ['primary', 'secondary', 'backup'];
        }

        // Studied removes primary and secondary everywhere (including versatile-expanded lists)
        if (loadoutState.isStudied) {
            allowedCategories = allowedCategories.filter(c => c !== 'primary' && c !== 'secondary');
        } else {
            // Professional removes primary everywhere (except backup which doesn't have primary anyway)
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

    // --- Loadout Code Helpers (encode/decode to base64) ---
    // Mapping from select IDs to id.json categories used for lookups
    const SELECT_TO_CATEGORY = {
        'shell-select': 'Shells',
        'backup-weapon-select': 'Weapons',
        'secondary-weapon-select': 'Weapons',
        'primary-weapon-select': 'Weapons',
        'secondary-optic-select': 'Optics',
        'secondary-ammo-select': 'Ammo',
        'primary-optic-select': 'Optics',
        'primary-ammo-select': 'Ammo',
        'primary-mod-1-select': 'Mods',
        'primary-mod-2-select': 'Mods',
        'primary-mod-3-select': 'Mods',
        'primary-mod-4-select': 'Mods',
        'secondary-mod-1-select': 'Mods',
        'secondary-mod-2-select': 'Mods',
        'secondary-mod-3-select': 'Mods',
        'secondary-mod-4-select': 'Mods',
        'augment-1-select': 'Augments',
        'augment-2-select': 'Augments',
        'augment-3-select': 'Augments',
        'augment-4-select': 'Augments',
        'device-1-select': 'Devices',
        'device-2-select': 'Devices'
    };

    // Field order and widths (decimal digits) used when encoding/decoding
    const ENCODE_FIELDS = [
        { id: 'shell-select', width: 2 },
        { id: 'backup-weapon-select', width: 3 },
        { id: 'primary-weapon-select', width: 3 },
        { id: 'secondary-weapon-select', width: 3 },

        { id: 'secondary-optic-select', width: 3 },
        { id: 'secondary-ammo-select', width: 3 },
        { id: 'secondary-mod-1-select', width: 3 },
        { id: 'secondary-mod-2-select', width: 3 },
        { id: 'secondary-mod-3-select', width: 3 },
        { id: 'secondary-mod-4-select', width: 3 },

        { id: 'primary-optic-select', width: 3 },
        { id: 'primary-ammo-select', width: 3 },
        { id: 'primary-mod-1-select', width: 3 },
        { id: 'primary-mod-2-select', width: 3 },
        { id: 'primary-mod-3-select', width: 3 },
        { id: 'primary-mod-4-select', width: 3 },

        { id: 'augment-1-select', width: 3 },
        { id: 'augment-2-select', width: 3 },
        { id: 'augment-3-select', width: 3 },
        { id: 'augment-4-select', width: 3 },

        { id: 'device-1-select', width: 3 },
        { id: 'device-2-select', width: 3 }
    ];

    function bigintToBase64(bigint) {
        if (bigint === 0n) return '';
        let b = bigint;
        const bytes = [];
        while (b > 0n) {
            bytes.push(Number(b & 0xFFn));
            b >>= 8n;
        }
        // bytes are little-endian; convert to big-endian string
        let binary = '';
        for (let i = bytes.length - 1; i >= 0; i--) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToBigInt(b64) {
        if (!b64) return 0n;
        const binary = atob(b64);
        let result = 0n;
        for (let i = 0; i < binary.length; i++) {
            result = (result << 8n) + BigInt(binary.charCodeAt(i));
        }
        return result;
    }

    function generateLoadoutCode() {
        // require idDataGlobal to be available
        if (!idDataGlobal || Object.keys(idDataGlobal).length === 0) return '';

        // Build numeric string by iterating ENCODE_FIELDS and reading select values
        let numeric = '';
        const debugParts = [];
        ENCODE_FIELDS.forEach(field => {
            const select = document.getElementById(field.id);
            let raw = '';
            if (!select) raw = '';
            else {
                const val = select.value || '';
                const category = SELECT_TO_CATEGORY[field.id];

                // If the selected option is already an id (digits), use that.
                if (/^\d+$/.test(val)) raw = val;
                else if (category && idDataGlobal[category]) {
                    // Try to find id by name in idDataGlobal (name -> id mapping)
                    const mapping = idDataGlobal[category];
                    // mapping might be an object name->id
                    if (mapping[val]) raw = String(mapping[val]);
                    else {
                        // Maybe val equals a name but case differs: try to find key by value
                        const found = Object.entries(mapping).find(([name, id]) => name === val || String(id) === val);
                        raw = found ? String(found[1]) : '';
                    }
                } else {
                    raw = '';
                }
            }
            numeric += raw.padStart(field.width, '0');
            debugParts.push({ field: field.id, value: select ? select.value : null, resolvedId: raw || null, padded: raw.padStart(field.width, '0') });
        });

        // Debug log the parts and numeric string so user can see what's encoded
        try {
            console.groupCollapsed('Loadout code generation');
            console.log('Resolved parts:', debugParts);
            console.log('Numeric string to encode:', numeric);
            console.groupEnd();
        } catch (e) {}

        // Convert numeric string to BigInt and then to base64
        const big = numeric ? BigInt(numeric) : 0n;
        const b64 = bigintToBase64(big);
        return b64;
    }

    function applyLoadoutCodeToFields(b64) {
        if (!b64) return;
        if (!idDataGlobal || Object.keys(idDataGlobal).length === 0) return;

        const big = base64ToBigInt(b64);
        let numeric = big.toString();

        // numeric may have lost leading zeros, so we need to left-pad to the total length
        const totalWidth = ENCODE_FIELDS.reduce((s, f) => s + f.width, 0);
        numeric = numeric.padStart(totalWidth, '0');

        // Slice numeric according to fields
        let idx = 0;
        const decoded = {};
        ENCODE_FIELDS.forEach(field => {
            const part = numeric.slice(idx, idx + field.width);
            idx += field.width;
            const value = part.replace(/^0+/, '') || '';
            decoded[field.id] = value;
        });

        // Set values for selects. First set non-attachment selects (weapons, shell, augments)
        const setSelectValue = (selectId, idValue) => {
            const select = document.getElementById(selectId);
            if (!select) return;
            // If there is an option with value == idValue -> set it
            if (idValue && select.querySelector(`option[value="${idValue}"]`)) {
                select.value = idValue;
                return;
            }
            // Otherwise try to map id -> name using reverseIdMaps
            const category = SELECT_TO_CATEGORY[selectId];
            if (category && reverseIdMaps[category] && reverseIdMaps[category][idValue]) {
                const name = reverseIdMaps[category][idValue];
                if (select.querySelector(`option[value="${name}"]`)) {
                    select.value = name;
                    return;
                }
            }
            // fallback: clear
            select.value = '';
        };

        // Set weapons + shell + augments + devices (devices use names in this app)
        setSelectValue('shell-select', decoded['shell-select']);
        setSelectValue('backup-weapon-select', decoded['backup-weapon-select']);
        setSelectValue('primary-weapon-select', decoded['primary-weapon-select']);
        setSelectValue('secondary-weapon-select', decoded['secondary-weapon-select']);

        setSelectValue('augment-1-select', decoded['augment-1-select']);
        setSelectValue('augment-2-select', decoded['augment-2-select']);
        setSelectValue('augment-3-select', decoded['augment-3-select']);
        setSelectValue('augment-4-select', decoded['augment-4-select']);

        // Devices may use keys that are names in the device options; reverseIdMaps['Devices'] maps id->name
        setSelectValue('device-1-select', decoded['device-1-select']);
        setSelectValue('device-2-select', decoded['device-2-select']);

        // Now update state and restrictions so attachment selects are repopulated correctly
        updateLoadoutState();
        applyLoadoutRestrictions();

        // Now set attachments (optic/ammo/mods) which typically have option values as names
        const setAttachmentById = (selectId, idValue) => {
            const select = document.getElementById(selectId);
            if (!select) return;
            const category = SELECT_TO_CATEGORY[selectId];
            const name = (category && reverseIdMaps[category]) ? reverseIdMaps[category][idValue] : null;

            // Try several matching strategies in order to be resilient to whether options use ids or names:
            // 1) option.value === idValue
            // 2) option.value === name (id->name mapping from id.json)
            // 3) option.textContent === name
            // 4) case-insensitive matches on textContent
            if (idValue) {
                // 1
                const byValue = Array.from(select.options).find(o => o.value === idValue);
                if (byValue) { select.value = idValue; return; }
            }
            if (name) {
                // 2
                const byNameValue = Array.from(select.options).find(o => o.value === name);
                if (byNameValue) { select.value = name; return; }

                // 3
                const byText = Array.from(select.options).find(o => (o.textContent || '') === name);
                if (byText) { select.value = byText.value; return; }

                // 4 - case-insensitive partial match
                const lower = name.toLowerCase();
                const byTextCI = Array.from(select.options).find(o => (o.textContent || '').toLowerCase() === lower || (o.textContent || '').toLowerCase().includes(lower));
                if (byTextCI) { select.value = byTextCI.value; return; }
            }

            // Fallback: if any option's text contains the numeric idValue, pick it
            if (idValue) {
                const byTextContainsId = Array.from(select.options).find(o => (o.textContent || '').includes(idValue));
                if (byTextContainsId) { select.value = byTextContainsId.value; return; }
            }

            // final fallback: clear
            select.value = '';
        };

        setAttachmentById('secondary-optic-select', decoded['secondary-optic-select']);
        setAttachmentById('secondary-ammo-select', decoded['secondary-ammo-select']);
        setAttachmentById('secondary-mod-1-select', decoded['secondary-mod-1-select']);
        setAttachmentById('secondary-mod-2-select', decoded['secondary-mod-2-select']);
        setAttachmentById('secondary-mod-3-select', decoded['secondary-mod-3-select']);
        setAttachmentById('secondary-mod-4-select', decoded['secondary-mod-4-select']);

        setAttachmentById('primary-optic-select', decoded['primary-optic-select']);
        setAttachmentById('primary-ammo-select', decoded['primary-ammo-select']);
        setAttachmentById('primary-mod-1-select', decoded['primary-mod-1-select']);
        setAttachmentById('primary-mod-2-select', decoded['primary-mod-2-select']);
        setAttachmentById('primary-mod-3-select', decoded['primary-mod-3-select']);
        setAttachmentById('primary-mod-4-select', decoded['primary-mod-4-select']);

        // Final apply to enforce restrictions and visual state
        updateLoadoutState();
        applyLoadoutRestrictions();
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
                // Create option. Prefer using the numeric id (from id.json) as the option value
                const option = document.createElement('option');
                // Determine category name as used in idDataGlobal (Optic->Optics, Ammo->Ammo, Mod->Mods)
                let category = attachmentType;
                if (attachmentType === 'Optic') category = 'Optics';
                else if (attachmentType === 'Mod') category = 'Mods';

                // Try to find a numeric id for this attachment name
                let resolvedId = null;
                try {
                    if (idDataGlobal && idDataGlobal[category]) {
                        // Direct lookup by exact name
                        if (idDataGlobal[category][attachment.name]) resolvedId = String(idDataGlobal[category][attachment.name]);
                        else {
                            // Case-insensitive match fallback
                            const found = Object.entries(idDataGlobal[category]).find(([n, i]) => n.toLowerCase() === (attachment.name || '').toLowerCase());
                            if (found) resolvedId = String(found[1]);
                        }
                    }
                } catch (e) { /* ignore */ }

                // Set option value to the numeric id when available; otherwise fall back to the attachment name
                option.value = resolvedId || attachment.name;
                option.textContent = attachment.name;
                // Keep a data-name to preserve original name for matching/debug
                option.dataset.name = attachment.name;
                // Mark dataset.tech if this attachment requires Technician
                if (isTechnicianRequired) option.dataset.tech = '1'; else delete option.dataset.tech;

                // Preserve previous selection if names/ids match
                if ((resolvedId && resolvedId === currentValue) || (!resolvedId && attachment.name === currentValue) || (attachment.name === currentValue)) {
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
            idDataGlobal = idData || {};
            // Debug: surface id.json load to console for troubleshooting
            try { console.log('Loaded id.json keys:', Object.keys(idDataGlobal)); } catch (e) {}
            allDevicesData = devicesData.map(d => ({ ...d, id: d.name })); // Use name as ID since no IDs are provided
            allAttachmentsData = attachmentsData;

            // Build reverseIdMaps: for each category in idDataGlobal, create id->name map
            reverseIdMaps = {};
            for (const [category, mapping] of Object.entries(idDataGlobal)) {
                if (typeof mapping === 'object') {
                    reverseIdMaps[category] = {};
                    for (const [name, id] of Object.entries(mapping)) {
                        reverseIdMaps[category][String(id)] = name;
                    }
                }
            }

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

            // Build technician-only ammo list dynamically from attachments.json and id.json (Ammo mapping)
            try {
                TECHNICIAN_ONLY_AMMO_IDS = [];
                if (Array.isArray(allAttachmentsData) && idData && idData.Ammo) {
                    for (const att of allAttachmentsData) {
                        if (!att || att.type !== 'Ammo') continue;
                        if (att.technician !== "true") continue;
                        const name = att.name;
                        let id = idData.Ammo[name];
                        if (!id) {
                            const found = Object.entries(idData.Ammo).find(([n, i]) => n.toLowerCase() === String(name).toLowerCase());
                            if (found) id = found[1];
                        }
                        if (id) TECHNICIAN_ONLY_AMMO_IDS.push(String(id));
                    }
                    TECHNICIAN_ONLY_AMMO_IDS = Array.from(new Set(TECHNICIAN_ONLY_AMMO_IDS));
                }
                console.log('Technician-only ammo ids (computed):', TECHNICIAN_ONLY_AMMO_IDS);
            } catch (e) { console.warn('Error building TECHNICIAN_ONLY_AMMO_IDS', e); }

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
        updateLoadoutState();
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);
        populateWeaponSelect('secondary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);
        populateWeaponSelect('primary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, false);

        // Populate attachments (temporarily populate with all, filtering will happen in applyLoadoutRestrictions)
        populateSelect('secondary-optic-select', data.Optics);
        populateSelect('secondary-ammo-select', data.Ammo);
        // Tag ammo options with a data attribute if they are technician-only
        markTechnicianAmmoOptions();
        SECONDARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));

        populateSelect('primary-optic-select', data.Optics);
        populateSelect('primary-ammo-select', data.Ammo);
        // Tag ammo options again for primary
        markTechnicianAmmoOptions();
        PRIMARY_MOD_SELECTS.forEach(id => populateSelect(id, data.Mods));
        
        // Helper: mark ammo options with dataset.tech='1' when they match computed technician-only IDs
        function markTechnicianAmmoOptions() {
            try {
                const ammoSelectIds = ['secondary-ammo-select', 'primary-ammo-select'];
                ammoSelectIds.forEach(selId => {
                    const sel = document.getElementById(selId);
                    if (!sel) return;
                    Array.from(sel.options).forEach(opt => {
                        if (!opt.value) return;
                        const val = String(opt.value).trim();
                        const name = (opt.textContent || '').trim();
                        let mark = false;
                        if (TECHNICIAN_ONLY_AMMO_IDS.includes(val)) mark = true;
                        else if (reverseIdMaps['Ammo']) {
                            for (const id of TECHNICIAN_ONLY_AMMO_IDS) {
                                if (reverseIdMaps['Ammo'][id] === name) { mark = true; break; }
                            }
                        }
                        if (mark) opt.dataset.tech = '1'; else delete opt.dataset.tech;
                    });
                });
            } catch (e) { console.warn('markTechnicianAmmoOptions failed', e); }
        }
        
        // --- Add Event Listeners ---
        const allSelects = document.querySelectorAll('.container select');
        allSelects.forEach(select => {
            select.addEventListener('change', handleLoadoutChange);
        });

        // --- Loadout Code UI ---
        // Wire existing input/button/output if present, otherwise create them
        let codeContainer = document.getElementById('loadout-code-container');
        if (!codeContainer) {
            codeContainer = document.createElement('div');
            codeContainer.id = 'loadout-code-container';
            codeContainer.style.margin = '10px 0';

            const input = document.createElement('input');
            input.id = 'loadout-code-input';
            input.type = 'text';
            input.placeholder = 'Paste loadout code here';
            input.style.width = '60%';
            input.style.marginRight = '8px';

            const btn = document.createElement('button');
            btn.id = 'loadout-code-apply-btn';
            btn.textContent = 'Enter';

            const out = document.createElement('input');
            out.id = 'loadout-code-output';
            out.type = 'text';
            out.readOnly = true;
            out.style.width = '60%';
            out.style.marginLeft = '8px';

            codeContainer.appendChild(input);
            codeContainer.appendChild(btn);
            codeContainer.appendChild(out);

            const root = document.querySelector('.container') || document.body;
            root.insertBefore(codeContainer, root.firstChild);
        }

        // Elements (either existing in HTML or newly created)
        const codeInput = document.getElementById('loadout-code-input');
        const codeBtn = document.getElementById('loadout-code-apply-btn');
        const codeOut = document.getElementById('loadout-code-output');

        // Wire interactions (idempotent wiring is fine)
        if (codeBtn && codeInput) {
            codeBtn.addEventListener('click', () => {
                const v = codeInput.value.trim();
                if (v) applyLoadoutCodeToFields(v);
            });

            codeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = codeInput.value.trim();
                    if (v) applyLoadoutCodeToFields(v);
                }
            });
        }

        const updateOutput = () => {
            if (!codeOut) return;
            const code = generateLoadoutCode();
            codeOut.value = code || '';
        };

        // When any select changes, update the output code
        allSelects.forEach(s => s.addEventListener('change', updateOutput));
        // Also run once now
        updateOutput();

        // Run once on startup to ensure initial state and restrictions are applied
        updateLoadoutState();
        applyLoadoutRestrictions();

        // Start continuous technician ammo availability check loop after function is defined
        if (technicianAmmoCheckInterval) clearInterval(technicianAmmoCheckInterval);
        technicianAmmoCheckInterval = setInterval(() => {
            try {
                updateTechnicianAmmoAvailability();
            } catch (e) { console.warn('Loop: updateTechnicianAmmoAvailability failed', e); }
        }, 100);
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
     * Updates technician-only ammo availability (grey/disable options).
     */
    function updateTechnicianAmmoAvailability() {
        const ammoSelectIds = ['secondary-ammo-select', 'primary-ammo-select'];
        ammoSelectIds.forEach(selId => {
            const sel = document.getElementById(selId);
            if (!sel) return;
            Array.from(sel.options).forEach(opt => {
                if (!opt.value) return; // skip placeholder
                
                let isTechnicianOnly = false;
                const optionName = (opt.textContent || '').trim();
                const optionValue = (opt.value || '').trim();
                
                // Prefer explicit data tag set during population; fallback to id/name checks
                if (opt.dataset && opt.dataset.tech === '1') {
                    isTechnicianOnly = true;
                } else if (TECHNICIAN_ONLY_AMMO_IDS.includes(optionValue)) {
                    isTechnicianOnly = true;
                } else if (reverseIdMaps['Ammo']) {
                    for (const ammoid of TECHNICIAN_ONLY_AMMO_IDS) {
                        if (reverseIdMaps['Ammo'][ammoid] === optionName) {
                            isTechnicianOnly = true;
                            break;
                        }
                    }
                }

                if (isTechnicianOnly) {
                    const shouldDisable = !loadoutState.isTechnician;
                    // Don't disable the currently selected option to avoid flicker
                    if (opt.value !== sel.value) {
                        opt.disabled = shouldDisable;
                        opt.classList.toggle('technician-only-restricted', shouldDisable);
                    }
                    opt.title = shouldDisable ? 'Requires the Technician augment.' : '';
                }
            });
        });
    }
    
    /**
     * Applies all loadout restrictions.
     */
    function applyLoadoutRestrictions() {
        updateLoadoutState();

        // Rebuild all weapon selects based on augments
        populateWeaponSelect('backup-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState.isHeavyWeapons);
        populateWeaponSelect('secondary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState.isHeavyWeapons);
        populateWeaponSelect('primary-weapon-select', allWeaponsData, WEAPON_CATEGORIES, loadoutState.isHeavyWeapons);

        // ...keep your uniqueness enforcement on weapons here (no duplicates across slots)...

        WEAPON_SELECTS.forEach(currentSelectId => {
             const currentSelect = document.getElementById(currentSelectId);
             const currentValue = currentSelect?.value;
             if (!currentValue) return;

             // Always enforce weapon uniqueness
             const otherSelectedWeapons = loadoutState.weapons.all.filter(id => id && id !== currentValue);
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
            .map(id => document.getElementById(id)?.value)
            .filter(val => val);

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

                // Base requirements
                if (requiresNeurohacker && !loadoutState.isNeurohacker) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Neurohacker Augment.';
                } else if (requiresExperimental && !loadoutState.isExperimental) {
                    shouldDisable = true;
                    restrictionReason = 'Requires the Experimental Augment.';
                }

                // Uniqueness (unless Versatile allows duplicates)
                const isDuplicate = otherDeviceValues.includes(option.value);
                if (isDuplicate && !loadoutState.isVersatile) {
                    shouldDisable = true;
                    restrictionReason = 'Already Equipped in another slot.';
                }

                // Studied restriction: only allow specific devices
                if (loadoutState.isStudied) {
                    const allowedStudiedDevices = ["Bolster", "Overcharge", "Shroud", "Reserve Stim"];
                    const isAllowedByStudied = allowedStudiedDevices.includes(deviceName);
                    if (!isAllowedByStudied) {
                        shouldDisable = true;
                        restrictionReason = 'Studied restricts devices to Bolster, Overcharge, Shroud, Reserve Stim.';
                    }
                }

                // Apply the disable and tooltip (don’t change current option to avoid flicker)
                if (option.value !== currentValue) {
                    option.disabled = shouldDisable;
                    option.title = shouldDisable ? restrictionReason : '';
                }

                // Mark invalid if current selection is now illegal
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

        // Technician-only ammo: grey out options unless Technician augment equipped
        updateTechnicianAmmoAvailability();

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