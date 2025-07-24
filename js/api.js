import { config } from './config.js';

async function fetchApiData(queryGuid, params) {
    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: { 'Api-Token': config.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ "QueryGuid": queryGuid, "Params": params })
        });
        if (!response.ok) {
            console.error(`Error ${response.status} en la consulta API para ${queryGuid}.`);
            return [];
        }
        return await response.json();
    } catch (error) {
        console.error("Error de red o de fetch:", error);
        return [];
    }
}

/**
 * Función que gestiona la caché, ahora aceptando el nombre del campo de fecha.
 * @param {string} reportGuid - El GUID del informe.
 * @param {object} requestedDates - El rango de fechas solicitado.
 * @param {string} dateFieldName - El nombre del campo de fecha a usar para filtrar (ej: "BusinessDay").
 */
async function fetchAndCache(reportGuid, requestedDates, dateFieldName) {
    if (!requestedDates) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const requestedToDate = new Date(requestedDates.to);
    requestedToDate.setHours(0, 0, 0, 0);

    if (requestedToDate >= today) {
        console.log(`🚀 Petición incluye 'hoy' para ${reportGuid}. Saltando caché.`);
        return await fetchApiData(reportGuid, requestedDates);
    }
    
    const requestedFrom = new Date(requestedDates.from);
    requestedFrom.setHours(0, 0, 0, 0);

    const allKeys = await localforage.keys();
    const reportKeys = allKeys.filter(key => key.startsWith(`cache_${reportGuid}_`));

    for (const key of reportKeys) {
        const [,, cachedFromStr, cachedToStr] = key.split('_');
        const cachedFrom = new Date(cachedFromStr);
        cachedFrom.setHours(0, 0, 0, 0);
        const cachedTo = new Date(cachedToStr);
        cachedTo.setHours(0, 0, 0, 0);

        if (requestedFrom >= cachedFrom && requestedToDate <= cachedTo) {
            console.log(`✅ Cache HIT Inteligente para ${reportGuid}! Usando datos de ${key}.`);
            
            const supersetData = await localforage.getItem(key);

            // --- CORRECCIÓN: Usamos el dateFieldName que nos pasan para filtrar ---
            const filteredData = supersetData.filter(item => {
                const dateField = item[dateFieldName];
                if (!dateField) return false;

                const itemDate = new Date(dateField);
                itemDate.setHours(0, 0, 0, 0);
                
                return !isNaN(itemDate.getTime()) && itemDate >= requestedFrom && itemDate <= requestedToDate;
            });
            
            console.log(`Filtrado completo. Se encontraron ${filteredData.length} registros en el rango.`);
            return filteredData;
        }
    }

    const cacheKey = `cache_${reportGuid}_${requestedDates.from}_${requestedDates.to}`;
    console.log(`⚫️ Cache MISS for ${cacheKey}. Fetching from API...`);
    const apiData = await fetchApiData(reportGuid, requestedDates);

    if (apiData && apiData.length > 0) {
        try {
            await localforage.setItem(cacheKey, apiData);
            console.log(`📦 Saved ${cacheKey} to cache.`);
        } catch (error) {
            console.error("Error al guardar en localForage:", error);
        }
    }

    return apiData;
}


export async function fetchDualPeriodData(guid, mainDates, comparisonDates, dateFieldName) {
    const mainPromise = fetchAndCache(guid, mainDates, dateFieldName);
    const comparisonPromise = comparisonDates ? fetchAndCache(guid, comparisonDates, dateFieldName) : Promise.resolve(null);
    
    return await Promise.all([mainPromise, comparisonPromise]);
}