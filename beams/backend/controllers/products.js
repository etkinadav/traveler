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

        console.log('SAVE_PRO - Backend saveChanges endpoint hit');
        console.log('SAVE_PRO - Request timestamp:', new Date().toISOString());
        console.log('SAVE_PRO - Product ID:', productId);
        console.log('SAVE_PRO - Product Name Status:', productName?.status || 'MISSING');
        console.log('SAVE_PRO - Product Name Value:', productName?.value || 'MISSING');
        console.log('SAVE_PRO - Single Category Name Status:', singleCategoryName?.status || 'MISSING');
        console.log('SAVE_PRO - Plural Category Name Status:', pluralCategoryName?.status || 'MISSING');
        console.log('SAVE_PRO - Serial Name:', serialName || 'EMPTY');
        console.log('SAVE_PRO - Config Index:', currentConfigurationIndex);
        console.log('SAVE_PRO - Parameters Count:', parameters?.length || 0);
        
        if (parameters && parameters.length > 0) {
            console.log('SAVE_PRO - Parameters breakdown:', JSON.stringify({
                beamArrayCount: parameters.filter(p => p.type === 'beamArray').length,
                beamSingleCount: parameters.filter(p => p.type === 'beamSingle').length,
                numericCount: parameters.filter(p => typeof p.type === 'number').length,
                beamArrayDetails: parameters.filter(p => p.type === 'beamArray').map(p => ({
                    name: p.name,
                    valueType: Array.isArray(p.value) ? 'array' : typeof p.value,
                    valueLength: Array.isArray(p.value) ? p.value.length : 'not array',
                    value: p.value,
                    beamConfiguration: p.beamConfiguration
                }))
            }, null, 2));
        }

        // Validation
        console.log('SAVE_PRO - Starting validation checks');
        if (!productId) {
            console.log('SAVE_PRO - ERROR: Missing productId');
            return res.status(400).json({ error: 'Product ID is required' });
        }

        if (!ObjectId.isValid(productId)) {
            console.log('SAVE_PRO - ERROR: Invalid productId format:', productId);
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        // מציאת המוצר
        console.log('SAVE_PRO - Searching for product by ID:', productId);
        const product = await Product.findById(productId);
        if (!product) {
            console.log('SAVE_PRO - ERROR: Product not found in database');
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log('SAVE_PRO - Product found successfully:', JSON.stringify({
            productId: product._id,
            productName: product.name,
            productModel: product.model,
            configurationsCount: product.configurations?.length || 0,
            paramsCount: product.params?.length || 0
        }, null, 2));

        // קביעה האם זה דגם חדש
        const isNewModel = productName.status === 'new';
        console.log('SAVE_PRO - Model status determined:', JSON.stringify({
            isNewModel: isNewModel,
            productNameStatus: productName.status,
            currentConfigIndex: currentConfigurationIndex
        }));

        // עדכון המוצר
        console.log('SAVE_PRO - Starting product data update');
        await updateProductData(product, {
            productName,
            singleCategoryName,
            pluralCategoryName, 
            serialName,
            parameters,
            currentConfigurationIndex,
            isNewModel
        });

        // שמירת המוצר
        console.log('SAVE_PRO - Saving updated product to database');
        await product.save();
        
        console.log('SAVE_PRO - Product saved successfully to database');
        
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

        console.log('SAVE_PRO - Sending success response:', JSON.stringify(response, null, 2));
        res.json(response);

    } catch (error) {
        console.log('SAVE_PRO - ERROR: Exception occurred during save process');
        console.log('SAVE_PRO - Error details:', JSON.stringify({
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

    console.log('--- UPDATING PRODUCT DATA ---');

    // שלב 1: עדכון singleNames אם נדרש
    if (singleCategoryName.status === 'new' && serialName) {
        console.log(`Adding to singleNames: ${serialName} = ${singleCategoryName.value}`);
        product.singleNames = product.singleNames || {};
        product.singleNames[serialName] = singleCategoryName.value;
    }

    // שלב 2: עדכון names אם נדרש  
    if (pluralCategoryName.status === 'new' && serialName) {
        console.log(`Adding to names: ${serialName} = ${pluralCategoryName.value}`);
        product.names = product.names || {};
        product.names[serialName] = pluralCategoryName.value;
    }

    // שלב 3: עדכון/הוספת configuration אם דגם חדש
    let configurationIndex;
    if (isNewModel) {
        console.log('Creating new configuration');
        // הוספת configuration חדש
        const newConfig = {
            product: serialName, // השם הסידורי
            translatedName: productName.value
        };
        product.configurations = product.configurations || [];
        product.configurations.push(newConfig);
        configurationIndex = product.configurations.length - 1;
        console.log(`New configuration index: ${configurationIndex}`);
    } else {
        // מציאת האינדקס של הקונפיגורציה הנוכחית
        configurationIndex = currentConfigurationIndex || 0;
        console.log(`Using existing configuration index: ${configurationIndex}`);
        
        // עדכון השם אם השתנה (ללא יצירת דגם חדש)
        if (productName.status !== 'original' && product.configurations[configurationIndex]) {
            console.log(`Updating configuration name: ${productName.value}`);
            product.configurations[configurationIndex].translatedName = productName.value;
        }
    }

    // שלב 4: עדכון כל הפרמטרים
    if (parameters && parameters.length > 0) {
        console.log(`Updating ${parameters.length} parameters`);
        for (const paramData of parameters) {
            await updateParameter(product, paramData, configurationIndex, isNewModel);
        }
    }

    console.log('--- PRODUCT DATA UPDATE COMPLETE ---');
}

// עדכון פרמטר בודד
async function updateParameter(product, paramData, configIndex, isNewModel) {
    const { name, value, type, selectedBeamIndex, selectedTypeIndex, beamConfiguration } = paramData;
    
    console.log(`Updating parameter: ${name}, type: ${type}, value:`, value);
    
    // מציאת הפרמטר במוצר
    const param = product.params.find(p => p.name === name);
    if (!param) {
        console.log(`Parameter not found: ${name}`);
        return;
    }

    // עדכון לפי סוג הפרמטר
    switch (param.type) {
        case 0: // מספר שלם
        case 1: // מספר עשרוני  
        case 2: // בוליאן
            updateNumericParameter(param, value, configIndex, isNewModel);
            break;
            
        case 'beamSingle':
            updateBeamSingleParameter(param, value, beamConfiguration, configIndex, isNewModel);
            break;
            
        case 'beamArray':
            updateBeamArrayParameter(param, value, beamConfiguration, configIndex, isNewModel);
            break;
            
        default:
            console.log(`Unknown parameter type: ${param.type}`);
    }
}

function updateNumericParameter(param, value, configIndex, isNewModel) {
    console.log(`Updating numeric parameter: ${param.name}`);
    param.configurations = param.configurations || [];
    
    if (isNewModel) {
        // הוספה בסוף
        param.configurations.push(value);
        console.log(`Added value to end: ${value}`);
    } else {
        // עדכון במיקום הנכון
        param.configurations[configIndex] = value;
        console.log(`Updated index ${configIndex} with value: ${value}`);
    }
}

function updateBeamSingleParameter(param, value, beamConfiguration, configIndex, isNewModel) {
    console.log(`Updating beamSingle parameter: ${param.name}`);
    param.beamsConfigurations = param.beamsConfigurations || [];
    
    if (isNewModel) {
        // הוספה בסוף
        param.beamsConfigurations.push(beamConfiguration);
        console.log(`Added beam config to end: ${beamConfiguration}`);
    } else {
        // עדכון במיקום הנכון
        param.beamsConfigurations[configIndex] = beamConfiguration;
        console.log(`Updated beam config at index ${configIndex}: ${beamConfiguration}`);
    }
}

function updateBeamArrayParameter(param, value, beamConfiguration, configIndex, isNewModel) {
    console.log(`SAVE_PRO - Updating beamArray parameter: ${param.name}`);
    console.log('SAVE_PRO - beamArray value received (full array):', JSON.stringify(value, null, 2));
    console.log('SAVE_PRO - beamArray beam configuration:', beamConfiguration);
    console.log('SAVE_PRO - beamArray config index:', configIndex, 'isNewModel:', isNewModel);
    
    param.configurations = param.configurations || [];
    param.beamsConfigurations = param.beamsConfigurations || [];
    
    console.log('SAVE_PRO - beamArray before update:', JSON.stringify({
        configurationsLength: param.configurations.length,
        beamsConfigurationsLength: param.beamsConfigurations.length,
        existingConfigurations: param.configurations,
        existingBeamsConfigurations: param.beamsConfigurations
    }, null, 2));
    
    // וידוא שהvalue הוא מערך
    if (!Array.isArray(value)) {
        console.log(`SAVE_PRO - ERROR: beamArray ${param.name} value is not an array:`, typeof value, value);
        return;
    }
    
    if (isNewModel) {
        // הוספה בסוף - גם configurations וגם beamsConfigurations
        // שמירת המערך המלא כמו שהוא
        param.configurations.push([...value]); // העתקה מלאה של המערך
        param.beamsConfigurations.push(beamConfiguration);
        console.log(`SAVE_PRO - beamArray ADDED FULL array config to END (${value.length} items):`, JSON.stringify(value));
        console.log(`SAVE_PRO - beamArray ADDED beam config to END: ${beamConfiguration}`);
    } else {
        // עדכון במיקום הנכון
        // החלפת המערך הקיים במערך החדש המלא
        param.configurations[configIndex] = [...value]; // העתקה מלאה של המערך
        param.beamsConfigurations[configIndex] = beamConfiguration;
        console.log(`SAVE_PRO - beamArray UPDATED FULL array config at index ${configIndex} (${value.length} items):`, JSON.stringify(value));
        console.log(`SAVE_PRO - beamArray UPDATED beam config at index ${configIndex}: ${beamConfiguration}`);
    }
    
    console.log('SAVE_PRO - beamArray after update:', JSON.stringify({
        configurationsLength: param.configurations.length,
        beamsConfigurationsLength: param.beamsConfigurations.length,
        finalConfigurations: param.configurations,
        finalBeamsConfigurations: param.beamsConfigurations
    }, null, 2));
}

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
