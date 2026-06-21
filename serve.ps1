# Minimal static file server for STEELCAST (no external runtime required).
param([int]$Port = 8123, [string]$Root = $PSScriptRoot)

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "STEELCAST serving $Root at $prefix"

$mime = @{
  ".html" = "text/html; charset=utf-8";
  ".css"  = "text/css; charset=utf-8";
  ".js"   = "application/javascript; charset=utf-8";
  ".svg"  = "image/svg+xml";
  ".json" = "application/json";
  ".ico"  = "image/x-icon";
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }
  $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
  if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
  $path = Join-Path $Root $rel
  if (Test-Path $path -PathType Leaf) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  }
  $ctx.Response.OutputStream.Close()
}
