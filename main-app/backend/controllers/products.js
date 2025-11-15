const Product = require("../models/product");
const User = require('../models/user');

const e = require("express");
const ObjectId = require('mongoose').Types.ObjectId;

exports.getAllProducts = async (req, res, next) => {
    try {
        console.log('Fetching all products');
        const products = await Product.find({});
        console.log(`Found ${products.length} products`);
        
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching all products:', error);
        res.status(500).json({ message: "Error fetching products", error: error.message });
    }
};

exports.getProductById = async (req, res, next) => {
    const id = req.params.id;
    console.log('Fetching product with ID:', id);
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
    }
    try {
        // הדפסת כל ה-IDs הקיימים בקולקשן
        const allProducts = await Product.find({}, { _id: 1 });
        console.log('All product IDs in DB:', allProducts.map(p => p._id.toString()));

        let product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: "Fetching product failed!" });
    }
};

// Create a new product
exports.createProduct = async (req, res, next) => {
    try {
        console.log('Creating new product:', req.body);
        const product = new Product(req.body);
        const savedProduct = await product.save();
        console.log('Product created successfully:', savedProduct._id);
        res.status(201).json(savedProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: "Error creating product", error: error.message });
    }
};

// Delete a product
exports.deleteProduct = async (req, res, next) => {
    const id = req.params.id;
    console.log('Deleting product with ID:', id);
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
    }
    
    try {
        const deletedProduct = await Product.findByIdAndDelete(id);
        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        console.log('Product deleted successfully:', id);
        res.status(200).json({ message: "Product deleted successfully", deletedProduct });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: "Error deleting product", error: error.message });
    }
};

exports.saveChanges = async (req, res, next) => {
    console.log('🔥🔥🔥 SAVE_PRO_BACK - URGENT - Backend saveChanges called! 🔥🔥🔥');
    console.error('🔥🔥🔥 SAVE_PRO_BACK - URGENT - This should appear in console! 🔥🔥🔥');
    
    try {
        const { 
            productId, 
            productName, 
            singleCategoryName, 
            pluralCategoryName, 
            serialName, 
            currentConfigurationIndex,
            parameters 
        } = req.body;

        console.log('SAVE_PRO_BACK - Backend saveChanges endpoint hit');
        console.log('SAVE_PRO_BACK - Request timestamp:', new Date().toISOString());
        console.log('SAVE_PRO_BACK - Full request body:', JSON.stringify(req.body, null, 2));
        console.log('SAVE_PRO_BACK - Product ID:', productId);
        console.log('SAVE_PRO_BACK - Product Name:', JSON.stringify(productName, null, 2));
        console.log('SAVE_PRO_BACK - Single Category Name:', JSON.stringify(singleCategoryName, null, 2));
        console.log('SAVE_PRO_BACK - Plural Category Name:', JSON.stringify(pluralCategoryName, null, 2));
        console.log('SAVE_PRO_BACK - Serial Name:', serialName || 'EMPTY');
        console.log('SAVE_PRO_BACK - Config Index:', currentConfigurationIndex);
        console.log('SAVE_PRO_BACK - Parameters Count:', parameters?.length || 0);
        
        if (parameters && parameters.length > 0) {
            console.log('SAVE_PRO_BACK - Parameters breakdown:', JSON.stringify({
                numericCount: parameters.filter(p => typeof p.type === 'number' || p.type === '0' || p.type === '1' || p.type === '2').length,
                allParameters: parameters.map(p => ({
                    name: p.name,
                    type: p.type,
                    hasValue: p.value !== undefined,
                    value: p.value,
                    selectedTypeIndex: p.selectedTypeIndex
                }))
            }, null, 2));
        }

        // Validation
        console.log('SAVE_PRO_BACK - Starting validation checks');
        if (!productId) {
            console.log('SAVE_PRO_BACK - ERROR: Missing productId');
            return res.status(400).json({ error: 'Product ID is required' });
        }

        if (!ObjectId.isValid(productId)) {
            console.log('SAVE_PRO_BACK - ERROR: Invalid productId format:', productId);
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        // מציאת המוצר
        console.log('SAVE_PRO_BACK - Searching for product by ID:', productId);
        const product = await Product.findById(productId);
        if (!product) {
            console.log('SAVE_PRO_BACK - ERROR: Product not found in database');
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log('SAVE_PRO_BACK - Product found successfully:', JSON.stringify({
            productId: product._id,
            productName: product.name,
            productModel: product.model,
            configurationsCount: product.configurations?.length || 0,
            paramsCount: product.params?.length || 0,
            allParams: product.params?.map(p => ({
                name: p.name,
                type: p.type,
                hasConfigurations: !!p.configurations,
                configurationsLength: p.configurations?.length || 0
            })) || []
        }, null, 2));


        // קביעה האם זה דגם חדש
        const isNewModel = productName.status === 'new';
        console.log('SAVE_PRO_BACK - Model status determined:', JSON.stringify({
            isNewModel: isNewModel,
            productNameStatus: productName.status,
            currentConfigIndex: currentConfigurationIndex
        }, null, 2));

        // עדכון המוצר
        console.log('SAVE_PRO_BACK - Starting product data update');
        await updateProductData(product, {
            productName,
            singleCategoryName,
            pluralCategoryName, 
            serialName,
            parameters,
            currentConfigurationIndex,
            isNewModel
        });

        // בדיקה לפני השמירה: מה באמת יש באובייקט המוצר בזיכרון
        console.log('SAVE_PRO_BACK - All params before save:', JSON.stringify(product.params?.map(p => ({
            name: p.name,
            type: p.type,
            configurationsLength: p.configurations?.length || 0
        })), null, 2));

        // וידוא שMongoose יודע שהפרמטרים השתנו (markModified)
        console.log('SAVE_PRO_BACK - Marking params as modified for Mongoose');
        product.markModified('params');
        
        // סימון מפורש של configurations עבור כל פרמטר שהיה לו עדכון
        product.params.forEach((param, index) => {
            if (param.configurations && Array.isArray(param.configurations)) {
                product.markModified(`params.${index}.configurations`);
                console.log(`SAVE_PRO_BACK - Marked configurations as modified for param ${index} (${param.name})`);
            }
        });
        
        // שמירת המוצר
        console.log('SAVE_PRO_BACK - Saving updated product to database');
        await product.save();
        
        console.log('SAVE_PRO_BACK - Product saved successfully to database');
        
        const response = { 
            success: true, 
            message: 'Product updated successfully',
            product: {
                _id: product._id,
                name: product.name,
                translatedName: product.translatedName,
                model: product.model
            },
            timestamp: new Date().toISOString(),
            updatedConfigurationsCount: product.configurations?.length || 0,
            updatedParamsCount: product.params?.length || 0
        };

        console.log('SAVE_PRO_BACK - Sending success response:', JSON.stringify(response, null, 2));
        res.json(response);

    } catch (error) {
        console.log('SAVE_PRO_BACK - ERROR: Exception occurred during save process');
        console.log('SAVE_PRO_BACK - Error details:', JSON.stringify({
            message: error.message,
            stack: error.stack,
            name: error.name
        }, null, 2));
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};

// פונקציה עזר לעדכון נתוני המוצר
async function updateProductData(product, data) {
    const { 
        productName, 
        singleCategoryName, 
        pluralCategoryName, 
        serialName, 
        parameters, 
        currentConfigurationIndex,
        isNewModel 
    } = data;

    console.log('SAVE_PRO_BACK - --- UPDATING PRODUCT DATA ---');
    console.log('SAVE_PRO_BACK - updateProductData input:', JSON.stringify({
        productName: productName,
        singleCategoryName: singleCategoryName,
        pluralCategoryName: pluralCategoryName,
        serialName: serialName,
        currentConfigurationIndex: currentConfigurationIndex,
        isNewModel: isNewModel,
        parametersCount: parameters?.length || 0
    }, null, 2));

    // שלב 1: בדיקה אם צריך ליצור קטגוריה חדשה (אם אחד מהם חדש - מספיק אחד)
    const isNewCategory = (singleCategoryName.status === 'new' || pluralCategoryName.status === 'new');
    console.log('SAVE_PRO_BACK - Category status check:', JSON.stringify({
        isNewCategory: isNewCategory,
        singleStatus: singleCategoryName.status,
        pluralStatus: pluralCategoryName.status,
        serialName: serialName || 'MISSING',
        singleValue: singleCategoryName.value,
        pluralValue: pluralCategoryName.value
    }, null, 2));

    // 🎯 עדכון singleNames - אם הערך שונה מהמקורי וקיים serialName:
    // בודקים אם הערך החדש קיים כבר ב-singleNames, ואם לא - מוסיפים
    if (serialName && singleCategoryName.value) {
        product.singleNames = product.singleNames || {};
        const singleNamesValues = Object.values(product.singleNames);
        const valueExists = singleNamesValues.includes(singleCategoryName.value);
        
        console.log(`SAVE_PRO_BACK - Checking singleName: value="${singleCategoryName.value}", exists=${valueExists}`);
        
        if (!valueExists) {
            // הערך לא קיים - מוסיפים אותו
            product.singleNames[serialName] = singleCategoryName.value;
            console.log(`SAVE_PRO_BACK - ✅ Added to singleNames: ${serialName} = ${singleCategoryName.value}`);
        } else {
            // הערך קיים - לא מוסיפים
            console.log(`SAVE_PRO_BACK - ⚠️ SingleName value "${singleCategoryName.value}" already exists, not adding`);
            
            // אבל אולי צריך לעדכן את ה-key אם serialName שונה?
            // בואו נמצא את ה-key הקיים:
            const existingKey = Object.keys(product.singleNames).find(key => 
                product.singleNames[key] === singleCategoryName.value
            );
            if (existingKey && existingKey !== serialName) {
                console.log(`SAVE_PRO_BACK - ⚠️ Value exists with different key: ${existingKey}, requested key: ${serialName}`);
                // אנו משאירים את ה-key הקיים, לא מעדכנים
            }
        }
    } else if (!serialName && (singleCategoryName.status === 'new' || isNewModel)) {
        console.log('SAVE_PRO_BACK - ⚠️ WARNING: serialName missing but new category detected');
    }

    // 🎯 עדכון names - אם הערך שונה מהמקורי וקיים serialName:
    // בודקים אם הערך החדש קיים כבר ב-names, ואם לא - מוסיפים
    if (serialName && pluralCategoryName.value) {
        product.names = product.names || {};
        const namesValues = Object.values(product.names);
        const valueExists = namesValues.includes(pluralCategoryName.value);
        
        console.log(`SAVE_PRO_BACK - Checking pluralName: value="${pluralCategoryName.value}", exists=${valueExists}`);
        
        if (!valueExists) {
            // הערך לא קיים - מוסיפים אותו
            product.names[serialName] = pluralCategoryName.value;
            console.log(`SAVE_PRO_BACK - ✅ Added to names: ${serialName} = ${pluralCategoryName.value}`);
        } else {
            // הערך קיים - לא מוסיפים
            console.log(`SAVE_PRO_BACK - ⚠️ PluralName value "${pluralCategoryName.value}" already exists, not adding`);
            
            // אבל אולי צריך לעדכן את ה-key אם serialName שונה?
            // בואו נמצא את ה-key הקיים:
            const existingKey = Object.keys(product.names).find(key => 
                product.names[key] === pluralCategoryName.value
            );
            if (existingKey && existingKey !== serialName) {
                console.log(`SAVE_PRO_BACK - ⚠️ Value exists with different key: ${existingKey}, requested key: ${serialName}`);
                // אנו משאירים את ה-key הקיים, לא מעדכנים
            }
        }
    } else if (!serialName && (pluralCategoryName.status === 'new' || isNewModel)) {
        console.log('SAVE_PRO_BACK - ⚠️ WARNING: serialName missing but new category detected');
    }

    // שלב 3: עדכון/הוספת configuration אם דגם חדש
    let configurationIndex;
    if (isNewModel) {
        console.log('SAVE_PRO_BACK - Creating new configuration');
        
        // 🎯 קביעת product של הקונפיגורציה החדשה:
        // אם קטגוריה לא חדשה (שניהם original או other) -> singleName של הקונפיגורציה הנוכחית
        // אם קטגוריה חדשה -> serialName
        let configProduct;
        if (!isNewCategory) {
            // קטגוריה לא חדשה - נשתמש ב-singleName של הקונפיגורציה הנוכחית
            const currentConfig = product.configurations?.[currentConfigurationIndex || 0];
            configProduct = currentConfig?.product;
            console.log(`SAVE_PRO_BACK - Using existing category product: ${configProduct} (from current config)`);
            if (!configProduct) {
                // גיבוי - אם אין product בקונפיגורציה הנוכחית
                console.log('SAVE_PRO_BACK - WARNING: No product in current config, falling back to serialName');
                configProduct = serialName;
            }
        } else {
            // קטגוריה חדשה - נשתמש ב-serialName
            configProduct = serialName;
            console.log(`SAVE_PRO_BACK - Using new category serialName: ${configProduct}`);
            if (!configProduct) {
                console.log('SAVE_PRO_BACK - ERROR: serialName is required for new category but missing!');
            }
        }
        
        // הוספת configuration חדש (ללא name - לא צריך בקונפיגורציות חדשות)
        const newConfig = {
            product: configProduct,
            translatedName: productName.value
        };
        product.configurations = product.configurations || [];
        product.configurations.push(newConfig);
        configurationIndex = product.configurations.length - 1;
        console.log(`SAVE_PRO_BACK - New configuration created at index ${configurationIndex}:`, JSON.stringify(newConfig, null, 2));
    } else {
        // מציאת האינדקס של הקונפיגורציה הנוכחית
        configurationIndex = currentConfigurationIndex || 0;
        console.log(`SAVE_PRO_BACK - Using existing configuration index: ${configurationIndex}`);
        
        // עדכון השם אם השתנה (ללא יצירת דגם חדש)
        if (productName.status !== 'original' && product.configurations[configurationIndex]) {
            console.log(`SAVE_PRO_BACK - Updating configuration name: ${productName.value}`);
            product.configurations[configurationIndex].translatedName = productName.value;
        }
    }

    // שלב 4: עדכון כל הפרמטרים
    if (parameters && parameters.length > 0) {
        console.log(`SAVE_PRO_BACK - Updating ${parameters.length} parameters`);
        for (const paramData of parameters) {
            await updateParameter(product, paramData, configurationIndex, isNewModel);
        }
    }

    console.log('SAVE_PRO_BACK - --- PRODUCT DATA UPDATE COMPLETE ---');
}

// עדכון פרמטר בודד
async function updateParameter(product, paramData, configIndex, isNewModel) {
    const { name, value, type, selectedTypeIndex } = paramData;
    
    console.log(`SAVE_PRO_BACK - updateParameter called for: ${name}`);
    console.log(`SAVE_PRO_BACK - updateParameter full paramData:`, JSON.stringify(paramData, null, 2));
    console.log(`SAVE_PRO_BACK - updateParameter value:`, JSON.stringify(value, null, 2));
    console.log(`SAVE_PRO_BACK - updateParameter configIndex: ${configIndex}, isNewModel: ${isNewModel}`);
    
    // מציאת הפרמטר במוצר
    const param = product.params.find(p => p.name === name);
    if (!param) {
        console.log(`SAVE_PRO_BACK - ERROR: Parameter not found: ${name}`);
        return;
    }

    console.log(`SAVE_PRO_BACK - Found param in product:`, JSON.stringify({
        name: param.name,
        type: param.type,
        hasConfigurations: !!param.configurations,
        configurationsLength: param.configurations?.length || 0
    }, null, 2));

    // המרת type למספר אם הוא string (מ-prod.type שהוא string)
    const paramType = typeof param.type === 'string' ? param.type : String(param.type);
    const incomingType = typeof type === 'string' ? type : String(type);

    console.log(`SAVE_PRO_BACK - Parameter type comparison: param.type=${paramType} (${typeof param.type}), incoming type=${incomingType} (${typeof type})`);

    // עדכון לפי סוג הפרמטר
    if (paramType === 'boolian' || incomingType === 'boolian' || paramType === 'boolean' || incomingType === 'boolean') {
        // פרמטרים בוליאניים - משתמשים באותו לוגיקה כמו פרמטרים מספריים
        console.log(`SAVE_PRO_BACK - Updating boolean parameter: ${name}, type: ${paramType}, value: ${value}`);
        updateNumericParameter(param, value, configIndex, isNewModel);
    } else if (paramType === '0' || paramType === '1' || paramType === '2' || 
               paramType === 0 || paramType === 1 || paramType === 2 ||
               incomingType === '0' || incomingType === '1' || incomingType === '2') {
        // פרמטרים מספריים
        console.log(`SAVE_PRO_BACK - Updating numeric parameter: ${name}, type: ${paramType}`);
        updateNumericParameter(param, value, configIndex, isNewModel);
    } else {
        console.log(`SAVE_PRO_BACK - WARNING: Unknown parameter type: ${paramType} (${typeof paramType}) for parameter: ${name}`);
        console.log(`SAVE_PRO_BACK - WARNING: incomingType: ${incomingType} (${typeof incomingType})`);
    }
}

function updateNumericParameter(param, value, configIndex, isNewModel) {
    console.log(`SAVE_PRO_BACK - updateNumericParameter: ${param.name}, value: ${value}, configIndex: ${configIndex}, isNewModel: ${isNewModel}`);
    console.log(`SAVE_PRO_BACK - updateNumericParameter before:`, JSON.stringify({
        name: param.name,
        configurationsLength: param.configurations?.length || 0,
        configurations: param.configurations
    }, null, 2));
    
    param.configurations = param.configurations || [];
    
    if (isNewModel) {
        // הוספה בסוף לקונפיגורציה חדשה
        param.configurations.push(value);
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: Added numeric value to end of configurations: ${value}`);
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: configurations length after push: ${param.configurations.length}`);
    } else {
        // אתחול עד האינדקס הנדרש אם חסרים מקומות
        while (param.configurations.length <= configIndex) {
            param.configurations.push(null);
        }
        // עדכון במיקום הנכון
        param.configurations[configIndex] = value;
        console.log(`SAVE_PRO_BACK - Updated index ${configIndex} with value: ${value}`);
    }
    
    console.log(`SAVE_PRO_BACK - updateNumericParameter after:`, JSON.stringify({
        name: param.name,
        configurationsLength: param.configurations?.length || 0,
        configurations: param.configurations
    }, null, 2));
}

// מחיקת קונפיגורציה (דגם) מהמוצר
exports.deleteConfiguration = async (req, res, next) => {
    console.log('🔥🔥🔥 DELETE_CONFIG_BACK - Backend deleteConfiguration called! 🔥🔥🔥');
    
    try {
        const { 
            productId, 
            configurationIndex
        } = req.body;

        console.log('DELETE_CONFIG_BACK - Backend deleteConfiguration endpoint hit');
        console.log('DELETE_CONFIG_BACK - Request timestamp:', new Date().toISOString());
        console.log('DELETE_CONFIG_BACK - Full request body:', JSON.stringify(req.body, null, 2));
        console.log('DELETE_CONFIG_BACK - Product ID:', productId);
        console.log('DELETE_CONFIG_BACK - Configuration Index to delete:', configurationIndex);

        // Validation
        if (!productId) {
            console.log('DELETE_CONFIG_BACK - ERROR: Missing productId');
            return res.status(400).json({ error: 'Product ID is required' });
        }

        if (!ObjectId.isValid(productId)) {
            console.log('DELETE_CONFIG_BACK - ERROR: Invalid productId format:', productId);
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        if (configurationIndex === undefined || configurationIndex === null) {
            console.log('DELETE_CONFIG_BACK - ERROR: Missing configurationIndex');
            return res.status(400).json({ error: 'Configuration index is required' });
        }

        // מציאת המוצר
        console.log('DELETE_CONFIG_BACK - Searching for product by ID:', productId);
        const product = await Product.findById(productId);
        if (!product) {
            console.log('DELETE_CONFIG_BACK - ERROR: Product not found in database');
            return res.status(404).json({ error: 'Product not found' });
        }

        const configs = product.configurations || [];
        if (!configs[configurationIndex]) {
            console.log('DELETE_CONFIG_BACK - ERROR: Configuration not found at index:', configurationIndex);
            return res.status(404).json({ error: 'Configuration not found' });
        }

        const configToDelete = configs[configurationIndex];
        console.log('DELETE_CONFIG_BACK - Configuration to delete:', JSON.stringify(configToDelete, null, 2));
        console.log('DELETE_CONFIG_BACK - Configurations count before delete:', configs.length);

        // 🎯 שלב 1: מחיקה מ-configurations הראשי של המוצר
        configs.splice(configurationIndex, 1);
        console.log('DELETE_CONFIG_BACK - ✅ Deleted from main configurations array');
        console.log('DELETE_CONFIG_BACK - Configurations count after delete:', configs.length);

        // 🎯 שלב 2: מחיקה מכל הפרמטרים
        if (product.params && product.params.length > 0) {
            console.log('DELETE_CONFIG_BACK - Processing', product.params.length, 'parameters');
            
            for (const param of product.params) {
                // מחיקה מ-configurations של הפרמטר
                if (param.configurations && Array.isArray(param.configurations) && param.configurations.length > configurationIndex) {
                    console.log(`DELETE_CONFIG_BACK - Deleting from param ${param.name} configurations at index ${configurationIndex}`);
                    param.configurations.splice(configurationIndex, 1);
                    console.log(`DELETE_CONFIG_BACK - ✅ Param ${param.name}: Deleted from configurations, new length: ${param.configurations.length}`);
                } else {
                    console.log(`DELETE_CONFIG_BACK - ⚠️ Param ${param.name}: No configurations to delete or index out of range`);
                }
            }
        } else {
            console.log('DELETE_CONFIG_BACK - ⚠️ No parameters found in product');
        }

        // וידוא שMongoose יודע שהפרמטרים השתנו
        console.log('DELETE_CONFIG_BACK - Marking params as modified for Mongoose');
        product.markModified('params');
        product.markModified('configurations');
        
        // סימון מפורש של configurations עבור כל פרמטר
        product.params.forEach((param, index) => {
            if (param.configurations && Array.isArray(param.configurations)) {
                product.markModified(`params.${index}.configurations`);
            }
        });

        // שמירת המוצר
        console.log('DELETE_CONFIG_BACK - Saving updated product to database');
        await product.save();
        
        console.log('DELETE_CONFIG_BACK - ✅ Configuration deleted successfully from database');
        console.log('DELETE_CONFIG_BACK - Final configurations count:', product.configurations?.length || 0);

        const response = { 
            success: true, 
            message: 'Configuration deleted successfully',
            deletedConfiguration: configToDelete,
            remainingConfigurationsCount: product.configurations?.length || 0,
            timestamp: new Date().toISOString()
        };

        console.log('DELETE_CONFIG_BACK - Sending success response:', JSON.stringify(response, null, 2));
        res.json(response);

    } catch (error) {
        console.log('DELETE_CONFIG_BACK - ERROR: Exception occurred during delete process');
        console.log('DELETE_CONFIG_BACK - Error details:', JSON.stringify({
            message: error.message,
            stack: error.stack,
            name: error.name
        }, null, 2));
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};

// Get product by name
exports.getProductByName = async (req, res, next) => {
    const name = req.params.name;
    console.log('Fetching product with name:', name);
    
    try {
        let product = await Product.findOne({ name: name });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product by name:', error);
        res.status(500).json({ message: "Fetching product by name failed!" });
    }
};
