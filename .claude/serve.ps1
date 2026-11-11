$root = Split-Path -Parent $PSScriptRoot
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:5180/")
$l.Start()
Write-Host "Serving $root on http://localhost:5180/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($p -eq '') { $p = 'index.html' }
  $f = Join-Path $root $p
  if (Test-Path -LiteralPath $f -PathType Leaf) {
    $b = [IO.File]::ReadAllBytes($f)
    $types = @{'.html'='text/html; charset=utf-8'; '.svg'='image/svg+xml'; '.png'='image/png'; '.json'='application/json'; '.txt'='text/plain; charset=utf-8'; '.css'='text/css'; '.js'='text/javascript'}
    $ext = [IO.Path]::GetExtension($f).ToLower()
    if ($types.ContainsKey($ext)) { $ctx.Response.ContentType = $types[$ext] }
    $ctx.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}

