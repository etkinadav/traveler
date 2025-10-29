const Product = require("../models/product");
const User = require('../models/user');

const e = require("express");
const ObjectId = require('mongoose').Types.ObjectId;

exports.getAllProducts = async (req, res, next) => {
    try {
        console.log('Fetching all products');
        const products = await Product.find({});
        console.log(`Found ${products.length} products`);
        
        // Populate beams for each product's params
        const Beam = require('../models/beam');
        const productsPopulated = await Promise.all(products.map(async product => {
            const productObj = product.toObject();
            const paramsPopulated = await Promise.all(productObj.params.map(async param => {
                if ((param.type === 'beamArray' || param.type === 'beamSingle') && Array.isArray(param.beams) && param.beams.length > 0) {
                    param.beams = await Beam.find({ _id: { $in: param.beams } });
                }
                return param;
            }));
            productObj.params = paramsPopulated;
            return productObj;
        }));
        
        res.status(200).json(productsPopulated);
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

        // Populate beams for each param with type beamArray or beamSingle
        const Beam = require('../models/beam');
        const paramsPopulated = await Promise.all(product.params.map(async param => {
            if ((param.type === 'beamArray' || param.type === 'beamSingle') && Array.isArray(param.beams) && param.beams.length > 0) {
                param.beams = await Beam.find({ _id: { $in: param.beams } });
            }
            return param;
        }));
        product = product.toObject();
        product.params = paramsPopulated;
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
                beamArrayCount: parameters.filter(p => p.type === 'beamArray').length,
                beamSingleCount: parameters.filter(p => p.type === 'beamSingle').length,
                numericCount: parameters.filter(p => typeof p.type === 'number' || p.type === '0' || p.type === '1' || p.type === '2').length,
                allParameters: parameters.map(p => ({
                    name: p.name,
                    type: p.type,
                    hasValue: p.value !== undefined,
                    value: p.value,
                    hasBeamConfiguration: !!p.beamConfiguration,
                    beamConfiguration: p.beamConfiguration,
                    selectedBeamIndex: p.selectedBeamIndex,
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
                configurationsLength: p.configurations?.length || 0,
                hasBeamsConfigurations: !!p.beamsConfigurations,
                beamsConfigurationsLength: p.beamsConfigurations?.length || 0
            })) || []
        }, null, 2));

        // 🔍 בדיקה מפורטת של פרמטר shelfs במאגר
        const shelfsParam = product.params?.find(p => p.name === 'shelfs');
        if (shelfsParam) {
            console.log('SAVE_PRO_BACK - SHELFS PARAM IN DATABASE:', JSON.stringify({
                name: shelfsParam.name,
                type: shelfsParam.type,
                hasConfigurations: !!shelfsParam.configurations,
                configurationsLength: shelfsParam.configurations?.length || 0,
                configurations: shelfsParam.configurations || 'NO_CONFIGURATIONS',
                hasBeamsConfigurations: !!shelfsParam.beamsConfigurations,
                beamsConfigurationsLength: shelfsParam.beamsConfigurations?.length || 0,
                beamsConfigurations: shelfsParam.beamsConfigurations || 'NO_BEAMS_CONFIGURATIONS'
            }, null, 2));
        } else {
            console.log('SAVE_PRO_BACK - ERROR: shelfs parameter not found in database!');
        }

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

        // 🎯 ניקוי beamsConfigurations מפרמטרים מספריים (למנוע nulls)
        console.log('SAVE_PRO_BACK - Cleaning beamsConfigurations from numeric parameters');
        product.params.forEach(param => {
            const paramType = typeof param.type === 'string' ? param.type : String(param.type);
            // אם זה פרמטר מספרי (0, 1, 2) ולא beamSingle או beamArray
            if ((paramType === '0' || paramType === '1' || paramType === '2' || 
                 paramType === 0 || paramType === 1 || paramType === 2) &&
                paramType !== 'beamSingle' && paramType !== 'beamArray') {
                // אם יש beamsConfigurations עם nulls או ערכים, נמחק
                if (param.beamsConfigurations && Array.isArray(param.beamsConfigurations)) {
                    const hasNulls = param.beamsConfigurations.some(val => val === null);
                    if (hasNulls || param.beamsConfigurations.length > 0) {
                        delete param.beamsConfigurations;
                        console.log(`SAVE_PRO_BACK - Removed beamsConfigurations from numeric parameter: ${param.name}`);
                    }
                }
            }
        });

        // בדיקה לפני השמירה: מה באמת יש באובייקט המוצר בזיכרון
        console.log('SAVE_PRO_BACK - All params before save:', JSON.stringify(product.params?.map(p => ({
            name: p.name,
            type: p.type,
            configurationsLength: p.configurations?.length || 0,
            beamsConfigurationsLength: p.beamsConfigurations?.length || 0,
            beamsConfigurations: p.beamsConfigurations
        })), null, 2));
        
        const shelfsParamBeforeSave = product.params?.find(p => p.name === 'shelfs');
        if (shelfsParamBeforeSave) {
            console.log('SAVE_PRO_BACK - SHELFS PARAM BEFORE SAVE (in memory):', JSON.stringify({
                name: shelfsParamBeforeSave.name,
                configurationsLength: shelfsParamBeforeSave.configurations?.length || 0,
                configurations: shelfsParamBeforeSave.configurations,
                beamsConfigurationsLength: shelfsParamBeforeSave.beamsConfigurations?.length || 0,
                beamsConfigurations: shelfsParamBeforeSave.beamsConfigurations
            }, null, 2));
        }

        // וידוא שMongoose יודע שהפרמטרים השתנו (markModified)
        console.log('SAVE_PRO_BACK - Marking params as modified for Mongoose');
        product.markModified('params');
        
        // 🎯 חשוב מאוד: סימון מפורש של beamsConfigurations עבור כל פרמטר שהיה לו עדכון
        product.params.forEach((param, index) => {
            if (param.beamsConfigurations && Array.isArray(param.beamsConfigurations)) {
                product.markModified(`params.${index}.beamsConfigurations`);
                console.log(`SAVE_PRO_BACK - Marked beamsConfigurations as modified for param ${index} (${param.name})`);
            }
            if (param.configurations && Array.isArray(param.configurations)) {
                product.markModified(`params.${index}.configurations`);
                console.log(`SAVE_PRO_BACK - Marked configurations as modified for param ${index} (${param.name})`);
            }
        });
        
        // שמירת המוצר
        console.log('SAVE_PRO_BACK - Saving updated product to database');
        await product.save();
        
        console.log('SAVE_PRO_BACK - Product saved successfully to database');

        // בדיקה נוספת: איך נראה פרמטר shelfs אחרי השמירה
        const updatedShelfsParam = product.params?.find(p => p.name === 'shelfs');
        if (updatedShelfsParam) {
            console.log('SAVE_PRO_BACK - SHELFS PARAM AFTER SAVE:', JSON.stringify({
                name: updatedShelfsParam.name,
                configurationsLength: updatedShelfsParam.configurations?.length || 0,
                configurations: updatedShelfsParam.configurations,
                beamsConfigurationsLength: updatedShelfsParam.beamsConfigurations?.length || 0,
                beamsConfigurations: updatedShelfsParam.beamsConfigurations
            }, null, 2));
        }

        // 🔍 בדיקה נוספת: טעינה מחדש מהמאגר לוודא שהשמירה התבצעה
        console.log('SAVE_PRO_BACK - Reloading product from database to verify save...');
        const reloadedProduct = await Product.findById(productId).lean(); // lean() לתוצאה נקייה יותר
        const reloadedShelfsParam = reloadedProduct?.params?.find(p => p.name === 'shelfs');
        if (reloadedShelfsParam) {
            console.log('SAVE_PRO_BACK - SHELFS PARAM RELOADED FROM DB:', JSON.stringify({
                name: reloadedShelfsParam.name,
                configurationsLength: reloadedShelfsParam.configurations?.length || 0,
                configurations: reloadedShelfsParam.configurations,
                beamsConfigurationsLength: reloadedShelfsParam.beamsConfigurations?.length || 0,
                beamsConfigurations: reloadedShelfsParam.beamsConfigurations,
                beamsConfigAt3: reloadedShelfsParam.beamsConfigurations?.[3] || 'MISSING AT INDEX 3'
            }, null, 2));
            
            // 🎯 בדיקה ספציפית של האינדקס 3
            if (reloadedShelfsParam.beamsConfigurations && reloadedShelfsParam.beamsConfigurations.length > 3) {
                const valueAt3 = reloadedShelfsParam.beamsConfigurations[3];
                console.log(`SAVE_PRO_BACK - ✅ VERIFICATION: shelfs.beamsConfigurations[3] = "${valueAt3}"`);
                if (valueAt3 !== '50-50') {
                    console.log(`SAVE_PRO_BACK - ❌ ERROR: Expected "50-50" but got "${valueAt3}"`);
                } else {
                    console.log(`SAVE_PRO_BACK - ✅ SUCCESS: Value correctly saved as "50-50"`);
                }
            } else {
                console.log(`SAVE_PRO_BACK - ❌ ERROR: beamsConfigurations array too short or missing index 3`);
            }
        } else {
            console.log('SAVE_PRO_BACK - ERROR: Could not reload shelfs param from database!');
        }
        
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
    const { name, value, type, selectedBeamIndex, selectedTypeIndex, beamConfiguration } = paramData;
    
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
        configurationsLength: param.configurations?.length || 0,
        hasBeamsConfigurations: !!param.beamsConfigurations,
        beamsConfigurationsLength: param.beamsConfigurations?.length || 0
    }, null, 2));

    // המרת type למספר אם הוא string (מ-prod.type שהוא string)
    const paramType = typeof param.type === 'string' ? param.type : String(param.type);
    const incomingType = typeof type === 'string' ? type : String(type);

    console.log(`SAVE_PRO_BACK - Parameter type comparison: param.type=${paramType} (${typeof param.type}), incoming type=${incomingType} (${typeof type})`);

    // עדכון לפי סוג הפרמטר
    // בדיקה גם למספרים וגם ל-strings (כי מהפרונטאנד באים strings)
    if (paramType === 'beamSingle' || incomingType === 'beamSingle') {
        console.log(`SAVE_PRO_BACK - Updating beamSingle parameter: ${name} with beamConfiguration: ${beamConfiguration || 'MISSING'}`);
        if (!beamConfiguration) {
            console.log(`SAVE_PRO_BACK - ERROR: beamConfiguration is missing for beamSingle: ${name}`);
        }
        updateBeamSingleParameter(param, value, beamConfiguration, configIndex, isNewModel);
    } else if (paramType === 'beamArray' || incomingType === 'beamArray') {
        console.log(`SAVE_PRO_BACK - Updating beamArray parameter: ${name} with beamConfiguration: ${beamConfiguration || 'MISSING'}`);
        if (!beamConfiguration) {
            console.log(`SAVE_PRO_BACK - ERROR: beamConfiguration is missing for beamArray: ${name}`);
        }
        updateBeamArrayParameter(param, value, beamConfiguration, configIndex, isNewModel);
    } else if (paramType === '0' || paramType === '1' || paramType === '2' || 
               paramType === 0 || paramType === 1 || paramType === 2 ||
               incomingType === '0' || incomingType === '1' || incomingType === '2') {
        // פרמטרים מספריים - לא צריך beamsConfigurations
        console.log(`SAVE_PRO_BACK - Updating numeric parameter: ${name}, type: ${paramType}`);
        // 🎯 ניקוי beamsConfigurations אם קיים (למנוע nulls)
        if (param.beamsConfigurations && Array.isArray(param.beamsConfigurations)) {
            // אם יש nulls או ערכים, נמחק את המערך או נאתחל אותו לריק
            delete param.beamsConfigurations;
            console.log(`SAVE_PRO_BACK - Deleted beamsConfigurations for numeric parameter: ${name}`);
        }
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
        configurations: param.configurations,
        hasBeamsConfigurations: !!param.beamsConfigurations,
        beamsConfigurations: param.beamsConfigurations
    }, null, 2));
    
    param.configurations = param.configurations || [];
    
    // 🎯 וידוא שאין beamsConfigurations לפרמטר מספרי (למנוע nulls)
    if (param.beamsConfigurations) {
        delete param.beamsConfigurations;
        console.log(`SAVE_PRO_BACK - Removed beamsConfigurations for numeric parameter: ${param.name}`);
    }
    
    if (isNewModel) {
        // 🎯 הוספה בסוף לקונפיגורציה חדשה
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
        configurations: param.configurations,
        hasBeamsConfigurations: !!param.beamsConfigurations
    }, null, 2));
}

function updateBeamSingleParameter(param, value, beamConfiguration, configIndex, isNewModel) {
    console.log(`SAVE_PRO_BACK - updateBeamSingleParameter called: ${param.name}`);
    console.log(`SAVE_PRO_BACK - updateBeamSingleParameter input:`, JSON.stringify({
        paramName: param.name,
        beamConfiguration: beamConfiguration,
        configIndex: configIndex,
        isNewModel: isNewModel,
        value: value
    }, null, 2));
    console.log(`SAVE_PRO_BACK - updateBeamSingleParameter before:`, JSON.stringify({
        name: param.name,
        beamsConfigurationsLength: param.beamsConfigurations?.length || 0,
        beamsConfigurations: param.beamsConfigurations
    }, null, 2));
    
    if (!beamConfiguration) {
        console.log(`SAVE_PRO_BACK - ERROR: beamConfiguration is missing for beamSingle parameter: ${param.name}`);
        return;
    }
    
    param.beamsConfigurations = param.beamsConfigurations || [];
    
    if (isNewModel) {
        // 🎯 הוספה בסוף לקונפיגורציה חדשה
        param.beamsConfigurations.push(beamConfiguration);
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: Added beamSingle config to end: ${beamConfiguration}`);
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: beamsConfigurations length after push: ${param.beamsConfigurations.length}`);
    } else {
        // אתחול עד האינדקס הנדרש אם חסרים מקומות
        while (param.beamsConfigurations.length <= configIndex) {
            param.beamsConfigurations.push(null);
        }
        // עדכון במיקום הנכון
        param.beamsConfigurations[configIndex] = beamConfiguration;
        console.log(`SAVE_PRO_BACK - Updated beam config at index ${configIndex}: ${beamConfiguration}`);
    }
    
    console.log(`SAVE_PRO_BACK - updateBeamSingleParameter after:`, JSON.stringify({
        name: param.name,
        beamsConfigurationsLength: param.beamsConfigurations?.length || 0,
        beamsConfigurations: param.beamsConfigurations
    }, null, 2));
}

function updateBeamArrayParameter(param, value, beamConfiguration, configIndex, isNewModel) {
    console.error('🎯🎯🎯 SAVE_PRO_BACK - CRITICAL - updateBeamArrayParameter called! 🎯🎯🎯');
    console.log(`SAVE_PRO_BACK - Updating beamArray parameter: ${param.name}`);
    console.log('SAVE_PRO_BACK - updateBeamArrayParameter input:', JSON.stringify({
        paramName: param.name,
        value: value,
        beamConfiguration: beamConfiguration,
        configIndex: configIndex,
        isNewModel: isNewModel
    }, null, 2));
    console.log('SAVE_PRO_BACK - updateBeamArrayParameter before:', JSON.stringify({
        name: param.name,
        configurationsLength: param.configurations?.length || 0,
        beamsConfigurationsLength: param.beamsConfigurations?.length || 0,
        configurations: param.configurations,
        beamsConfigurations: param.beamsConfigurations
    }, null, 2));
    
    // בדיקה ש-beamConfiguration קיים
    if (!beamConfiguration) {
        console.log(`SAVE_PRO_BACK - ERROR: beamConfiguration is missing for beamArray parameter: ${param.name}`);
        console.log(`SAVE_PRO_BACK - ERROR: Cannot update beamArray without beamConfiguration`);
        return;
    }
    
    // וידוא שקיימים מערכי קונפיגורציות + אתחול נכון אם חסרים
    if (!param.configurations || !Array.isArray(param.configurations)) {
        console.log('SAVE_PRO_BACK - beamArray: Creating new configurations array');
        param.configurations = [];
    }
    if (!param.beamsConfigurations || !Array.isArray(param.beamsConfigurations)) {
        console.log('SAVE_PRO_BACK - beamArray: Creating new beamsConfigurations array');
        param.beamsConfigurations = [];
    }

    // אתחול מקומות ריקים עד האינדקס הנדרש אם חסרים (רק אם לא isNewModel)
    if (!isNewModel) {
        while (param.configurations.length <= configIndex) {
            console.log(`SAVE_PRO_BACK - beamArray: Filling configurations gap at index ${param.configurations.length}`);
            param.configurations.push([]);
            param.beamsConfigurations.push(null); // נשתמש ב-null במקום '' ונעדכן אחר כך
        }
    }
    
    console.log('SAVE_PRO_BACK - beamArray before update:', JSON.stringify({
        configurationsLength: param.configurations.length,
        beamsConfigurationsLength: param.beamsConfigurations.length,
        existingConfigurations: param.configurations,
        existingBeamsConfigurations: param.beamsConfigurations
    }, null, 2));
    
    // וידוא שהvalue הוא מערך
    if (!Array.isArray(value)) {
        console.log(`SAVE_PRO_BACK - ERROR: beamArray ${param.name} value is not an array:`, typeof value, value);
        return;
    }
    
    if (isNewModel) {
        // 🎯 הוספה בסוף לקונפיגורציה חדשה - beamArray
        // שמירת המערך המלא כמו שהוא
        param.configurations.push([...value]); // העתקה מלאה של המערך
        param.beamsConfigurations.push(beamConfiguration);
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: beamArray ADDED FULL array config to END (${value.length} items):`, JSON.stringify(value, null, 2));
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: beamArray ADDED beam config to END: ${beamConfiguration}`);
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: beamArray configurations length after push: ${param.configurations.length}`);
        console.log(`SAVE_PRO_BACK - ✅ NEW MODEL: beamArray beamsConfigurations length after push: ${param.beamsConfigurations.length}`);
    } else {
        // עדכון במיקום הנכון
        // החלפת המערך הקיים במערך החדש המלא
        param.configurations[configIndex] = [...value]; // העתקה מלאה של המערך
        param.beamsConfigurations[configIndex] = beamConfiguration;
        console.log(`SAVE_PRO_BACK - beamArray UPDATED FULL array config at index ${configIndex} (${value.length} items):`, JSON.stringify(value, null, 2));
        console.log(`SAVE_PRO_BACK - beamArray UPDATED beam config at index ${configIndex}: ${beamConfiguration}`);
    }
    
    console.log('SAVE_PRO_BACK - updateBeamArrayParameter after:', JSON.stringify({
        name: param.name,
        configurationsLength: param.configurations.length,
        beamsConfigurationsLength: param.beamsConfigurations.length,
        finalConfigurations: param.configurations,
        finalBeamsConfigurations: param.beamsConfigurations
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
                const paramType = typeof param.type === 'string' ? param.type : String(param.type);
                
                // מחיקה מ-configurations של הפרמטר
                if (param.configurations && Array.isArray(param.configurations) && param.configurations.length > configurationIndex) {
                    console.log(`DELETE_CONFIG_BACK - Deleting from param ${param.name} configurations at index ${configurationIndex}`);
                    
                    // עבור beamArray - צריך למחוק array שלם מתוך array של arrays
                    if (paramType === 'beamArray') {
                        console.log(`DELETE_CONFIG_BACK - beamArray: Deleting full array from configurations at index ${configurationIndex}`);
                        param.configurations.splice(configurationIndex, 1);
                        console.log(`DELETE_CONFIG_BACK - ✅ beamArray: Deleted array, new length: ${param.configurations.length}`);
                    } else {
                        // עבור פרמטרים רגילים - מחיקה של ערך בודד
                        param.configurations.splice(configurationIndex, 1);
                        console.log(`DELETE_CONFIG_BACK - ✅ Param ${param.name}: Deleted from configurations, new length: ${param.configurations.length}`);
                    }
                } else {
                    console.log(`DELETE_CONFIG_BACK - ⚠️ Param ${param.name}: No configurations to delete or index out of range`);
                }
                
                // מחיקה מ-beamsConfigurations של הפרמטר
                if (param.beamsConfigurations && Array.isArray(param.beamsConfigurations) && param.beamsConfigurations.length > configurationIndex) {
                    param.beamsConfigurations.splice(configurationIndex, 1);
                    console.log(`DELETE_CONFIG_BACK - ✅ Param ${param.name}: Deleted from beamsConfigurations, new length: ${param.beamsConfigurations.length}`);
                } else {
                    console.log(`DELETE_CONFIG_BACK - ⚠️ Param ${param.name}: No beamsConfigurations to delete or index out of range`);
                }
            }
        } else {
            console.log('DELETE_CONFIG_BACK - ⚠️ No parameters found in product');
        }

        // וידוא שMongoose יודע שהפרמטרים השתנו
        console.log('DELETE_CONFIG_BACK - Marking params as modified for Mongoose');
        product.markModified('params');
        product.markModified('configurations');
        
        // סימון מפורש של beamsConfigurations עבור כל פרמטר
        product.params.forEach((param, index) => {
            if (param.beamsConfigurations && Array.isArray(param.beamsConfigurations)) {
                product.markModified(`params.${index}.beamsConfigurations`);
            }
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

        // Populate beams for each param with type beamArray or beamSingle
        const Beam = require('../models/beam');
        const paramsPopulated = await Promise.all(product.params.map(async param => {
            if ((param.type === 'beamArray' || param.type === 'beamSingle') && Array.isArray(param.beams) && param.beams.length > 0) {
                param.beams = await Beam.find({ _id: { $in: param.beams } });
            }
            return param;
        }));
        product = product.toObject();
        product.params = paramsPopulated;

        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product by name:', error);
        res.status(500).json({ message: "Fetching product by name failed!" });
    }
};
