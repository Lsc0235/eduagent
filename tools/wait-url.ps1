param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [int]$Seconds = 60
)

$ErrorActionPreference = "SilentlyContinue"
$deadline = (Get-Date).AddSeconds($Seconds)

do {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      exit 0
    }
  }
  catch {
  }

  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

exit 1
