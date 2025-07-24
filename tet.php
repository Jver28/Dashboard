<?php
try {
    $apiToken = 'Balmes987654321';
    $apiUrl = '2.136.221.15:8984';


    // Realiza la solicitud HTTP
    $response = @file_get_contents('http://' . $apiUrl . '/api/export-master/?filter=Customers', false, stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Api-Token: $apiToken\r\n" .
                        "Content-Type: application/json; charset=utf-8\r\n"
        ]
    ]));


    if ($response === false) {
        // Si la solicitud falló, obtenemos el mensaje de error
        $errorMessage = error_get_last()['message'];
        echo $errorMessage;
    } else {
        echo $response;
    }
} catch (Exception $e) {
    // Manejo de errores
    echo "Ocurrió un error: " . $e->getMessage();
}
?>
