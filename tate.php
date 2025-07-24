<?php

// =========================================================================
// CONFIGURACIÓN
// =========================================================================

$holdedApiKey = '';
$contactIdGenerico = '6697b0a342a75908b907c13a';


// =========================================================================
// FUNCIÓN DE CÁLCULO DE PRECIO (DEVUELVE PRECIO UNITARIO)
// =========================================================================

function calcularPrecioFinalParaHolded($linea) {
    $precioUnitarioConIva = $linea['UnitPrice'];
    $precioConDtoPct = $precioUnitarioConIva
                       * (1 - $linea['DescuentoPorcentajeLinea'])
                       * (1 - $linea['DescuentoPorcentajeTicket']);
    $precioFinalConIva = $precioConDtoPct - $linea['DescuentoEfectivoLinea'];
    $precioFinalSinIva = $precioFinalConIva / (1 + $linea['VatRate']);
    return abs($precioFinalSinIva);
}


// =========================================================================
// OBTENER DATOS DE TU API REAL
// =========================================================================

function obtenerDatosVentas() {
    $hoy = new DateTime("now", new DateTimeZone('Europe/Madrid'));
    $trimestreActual = ceil($hoy->format('n') / 3);
    $primerMesUltimoTrimestre = ($trimestreActual - 2) * 3 + 1;
    $año = (int)$hoy->format('Y');
    if ($primerMesUltimoTrimestre <= 0) { $primerMesUltimoTrimestre += 12; $año -= 1; }
    $fechaDesdeObj = new DateTime("$año-$primerMesUltimoTrimestre-01");
    $fechaHastaObj = clone $fechaDesdeObj;
    $fechaHastaObj->modify('+3 months -1 day');
    $fechaDesde = $fechaDesdeObj->format('Y-m-d');
    $fechaHasta = $fechaHastaObj->format('Y-m-d');

    echo "<h3>Obteniendo datos de tu API desde el $fechaDesde hasta el $fechaHasta...</h3>";

    // Simulación de datos para prueba
    /*
    return json_decode('[
        {"Serie": "A", "Number": 1, "SaleFormatName": "Patatas", "Quantity": 1, "UnitPrice": 5.5, "VatRate": 0.10, "DescuentoPorcentajeLinea": 0, "DescuentoPorcentajeTicket": 0, "DescuentoEfectivoLinea": 0, "BusinessDay": "2025-07-18T10:00:00"},
        {"Serie": "A", "Number": 1, "SaleFormatName": "Refresco", "Quantity": 1, "UnitPrice": 2.2, "VatRate": 0.10, "DescuentoPorcentajeLinea": 0, "DescuentoPorcentajeTicket": 0, "DescuentoEfectivoLinea": 0, "BusinessDay": "2025-07-18T10:00:00"},
        {"Serie": "A", "Number": 1, "SaleFormatName": "Patatas", "Quantity": 1, "UnitPrice": 5.5, "VatRate": 0.10, "DescuentoPorcentajeLinea": 0, "DescuentoPorcentajeTicket": 0, "DescuentoEfectivoLinea": 0, "BusinessDay": "2025-07-18T10:00:00"},
        {"Serie": "A", "Number": 1, "SaleFormatName": "Patatas", "Quantity": 1, "UnitPrice": 5.5, "VatRate": 0.10, "DescuentoPorcentajeLinea": 0, "DescuentoPorcentajeTicket": 0, "DescuentoEfectivoLinea": 0, "BusinessDay": "2025-07-18T10:00:00"}
    ]', true);
    */
    
    $query_params = ["QueryGuid" => "{info-eco-rooftop}", "Params" => ["from" => $fechaDesde, "to" => $fechaHasta]];
    $query_json = json_encode($query_params);
    $url = 'http://85.51.226.249:8984/api/custom-query/';
    $headers = ['Api-Token: HOSTALGRAU2025$', 'Accept: application/json', 'Content-Type: application/json; charset=utf-8'];

    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $query_json, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]);
    $response = curl_exec($ch);
    if ($response === false) { die("Error en cURL a API de ventas: " . curl_error($ch)); }
    curl_close($ch);
    return json_decode($response, true);
}


// =========================================================================
// SECCIÓN CORREGIDA: PROCESAR Y AGRUPAR DATOS
// =========================================================================

$datosVentas = obtenerDatosVentas();
if (empty($datosVentas)) { die("No se obtuvieron datos de la API de ventas o la respuesta estaba vacía."); }

$ticketsAgrupados = [];
foreach ($datosVentas as $linea) {
    if (!isset($linea['Serie'], $linea['Number'], $linea['SaleFormatName'])) { continue; }

    $clave = $linea['Serie'] . '-' . $linea['Number'];
    if (!isset($ticketsAgrupados[$clave])) {
        $ticketsAgrupados[$clave] = ['docNumber' => $clave, 'businessDay' => $linea['BusinessDay'], 'items' => []];
    }

    $nombreProducto = $linea['SaleFormatName'];
    $precioUnitarioSinIva = calcularPrecioFinalParaHolded($linea);
    $unidades = (strpos($linea['Serie'], 'D') !== false)
              ? abs($linea['Quantity']) * -1
              : abs($linea['Quantity']);

    // --- LÓGICA DE SUMA CORRECTA ---
    if (isset($ticketsAgrupados[$clave]['items'][$nombreProducto])) {
        // Si el producto ya existe en este ticket, SOLO sumamos las unidades.
        $ticketsAgrupados[$clave]['items'][$nombreProducto]['units'] += $unidades;
        // NO TOCAMOS EL SUBTOTAL, porque es el precio unitario y ya fue establecido.
    } else {
        // Si el producto es nuevo en este ticket, lo creamos con todos sus datos.
        $ticketsAgrupados[$clave]['items'][$nombreProducto] = [
            'name'     => $nombreProducto,
            'units'    => $unidades,
            'subtotal' => $precioUnitarioSinIva, // Este es el PRECIO UNITARIO.
            'tax'      => $linea['VatRate'] * 100
        ];
    }
}

echo "<h1>Procesamiento de Tickets Completado</h1><hr>";


// =========================================================================
// PREVISUALIZACIÓN DE DATOS ANTES DE ENVIAR
// =========================================================================
echo "<h1>Previsualización de Datos a Enviar</h1>";
echo "<p>Revisa los datos agrupados antes de que se envíen a Holded.</p><hr>";

foreach ($ticketsAgrupados as $clave => $ticket) {
    $totalBaseImponible = 0;
    
    $tipoMostrado = (strpos($ticket['docNumber'], 'D') !== false) ? 'salesreceipt (Abono)' : 'salesreceipt';
    echo "<h2>Ticket: {$ticket['docNumber']} (Tipo: $tipoMostrado)</h2>";
    echo "<p>Fecha: " . substr($ticket['businessDay'], 0, 10) . "</p>";
    
    echo "<table border='1' cellpadding='5' style='width:100%; border-collapse: collapse;'>
            <tr style='background-color:#f2f2f2;'>
                <th>Producto</th>
                <th>Unidades</th>
                <th>Precio Unitario (sin IVA)</th>
                <th>Total Línea (sin IVA)</th>
                <th>IVA %</th>
            </tr>";

    foreach ($ticket['items'] as $item) {
        $totalLinea = $item['units'] * $item['subtotal'];
        $totalBaseImponible += $totalLinea;
        echo "<tr>
                <td>{$item['name']}</td>
                <td><b>{$item['units']}</b></td>
                <td>" . number_format($item['subtotal'], 4, ',', '.') . " €</td>
                <td>" . number_format($totalLinea, 2, ',', '.') . " €</td>
                <td>{$item['tax']}%</td>
              </tr>";
    }

    $totalIva = $totalBaseImponible * ($item['tax'] / 100); // Asume mismo IVA para todo el ticket
    $totalTicket = $totalBaseImponible + $totalIva;

    echo "</table>";
    echo "<p style='margin-top:10px;'><b>Resumen del Ticket:</b><br>
          Total Base Imponible: " . number_format($totalBaseImponible, 2, ',', '.') . " €<br>
          Total IVA (aprox): " . number_format($totalIva, 2, ',', '.') . " €<br>
          <b>Total Final: " . number_format($totalTicket, 2, ',', '.') . " €</b>
          </p>";
    echo "<hr>";
}


// =========================================================================
// ENVIAR A HOLDED (CON LOS DATOS YA VERIFICADOS)
// =========================================================================
echo "<h1>Inicio del Envío a Holded</h1><hr>";

foreach ($ticketsAgrupados as $clave => $ticket) {
    // Convierte el array asociativo de items a un array numérico para el JSON final.
    $itemsFinales = array_values($ticket['items']);
    $docType = 'salesreceipt';
    $tipoMostrado = (strpos($ticket['docNumber'], 'D') !== false) ? 'salesreceipt (Abono)' : 'salesreceipt';

    echo "<h2>Enviando ticket real: $clave (Tipo: $tipoMostrado)</h2>";

    $payloadHolded = ['contactId' => $contactIdGenerico, 'invoiceNum' => $ticket['docNumber'], 'date' => strtotime(substr($ticket['businessDay'], 0, 10)), 'items' => $itemsFinales];
    $payloadJson = json_encode($payloadHolded, JSON_PRETTY_PRINT);
    echo "<strong>JSON final y limpio que se enviará a Holded:</strong><pre>$payloadJson</pre>";

    // Descomenta las siguientes líneas para activar el envío real a Holded
    $holdedUrl = 'https://api.holded.com/api/invoicing/v1/documents/' . $docType;
    $holdedHeaders = ['Accept: application/json', 'Content-Type: application/json', 'key: ' . $holdedApiKey];
    $chHolded = curl_init($holdedUrl);
    curl_setopt_array($chHolded, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($payloadHolded), CURLOPT_HTTPHEADER => $holdedHeaders, CURLOPT_RETURNTRANSFER => true]);
    $responseHolded = curl_exec($chHolded);
    $httpCode = curl_getinfo($chHolded, CURLINFO_HTTP_CODE);
    curl_close($chHolded);
    if ($httpCode == 201 || $httpCode == 200) { echo "<strong style='color:green;'>ÉXITO: Documento creado en Holded.</strong>"; }
    else { echo "<strong style='color:red;'>ERROR: Código $httpCode</strong><p>Respuesta:</p><pre>" . htmlspecialchars($responseHolded) . "</pre>"; }
    echo "<strong style='color:blue;'>INFO: El envío real a Holded está comentado en el código. Descoméntalo para activarlo.</strong>";
    echo "<hr>";
}
echo "<h2>Proceso completado.</h2>";

?>