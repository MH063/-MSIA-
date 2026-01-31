
# Set output encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Get-MSIAHost {
    <#
    .SYNOPSIS
    Get backend host, prefer NIC IPv4 to avoid localhost hijack
    #>
    if ($env:MSIA_HOST -and $env:MSIA_HOST.Trim()) {
        return $env:MSIA_HOST.Trim()
    }
    try {
        $ip = Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object {
                $_.IPAddress -and
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.PrefixOrigin -ne 'WellKnown'
            } |
            Select-Object -First 1 -ExpandProperty IPAddress
        if ($ip) { return $ip }
    } catch {
        # ignore
    }
    return 'localhost'
}

function Get-ResponseData {
    <#
    .SYNOPSIS
    Unwrap { success, data } and { success, data: { data: T } }
    #>
    param(
        [Parameter(Mandatory = $true)]
        $responseObject
    )
    if (-not $responseObject) { return $null }
    $d = $responseObject.data
    if ($null -eq $d) { return $null }
    if ($d.PSObject.Properties.Name -contains 'data') {
        return $d.data
    }
    return $d
}

function Get-StringMD5 {
    <#
    .SYNOPSIS
    Compute MD5 hash for a UTF-8 string (hex lowercase)
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$text
    )
    $md5 = [System.Security.Cryptography.MD5]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
        $hashBytes = $md5.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
    } finally {
        $md5.Dispose()
    }
}

$baseHost = Get-MSIAHost
$baseUrl = "http://$baseHost`:4000/api"
$headers = @{ "Content-Type" = "application/json; charset=utf-8" }

Write-Host "Starting full-flow test v3 (9 modules)..."
Write-Host "Base URL: $baseUrl"

# 1) Create patient
$patientBody = @{
    name = "Zhang San"
    gender = "Female"
    age = 32
    phone = "13800138000"
}
$patientJson = $patientBody | ConvertTo-Json
$patientId = 0

try {
    Write-Host "Creating patient..."
    $resPatient = Invoke-WebRequest -Uri "$baseUrl/patients" -Method Post -Body $patientJson -Headers $headers -ErrorAction Stop
    $patientData = $resPatient.Content | ConvertFrom-Json
    $patientId = (Get-ResponseData $patientData).id
    Write-Host "Created patient ID: $patientId"
} catch {
    Write-Host "Error creating patient: $_"
    # Fallback to 1 if create fails (assume exists)
    $patientId = 1
    Write-Host "Fallback to patient ID: 1"
}

# 2) Create session
$createBody = @{
    patientId = $patientId
    type = "consultation"
}
$createJson = $createBody | ConvertTo-Json
try {
    Write-Host "Creating session..."
    $res = Invoke-WebRequest -Uri "$baseUrl/sessions" -Method Post -Body $createJson -Headers $headers -ErrorAction Stop
    $session = $res.Content | ConvertFrom-Json
    $sessionId = (Get-ResponseData $session).id
    Write-Host "Created session ID: $sessionId"
} catch {
    Write-Host "Error creating session: $_"
    Write-Host "Response: $( $_.ErrorDetails.Message )"
    exit 1
}

# 3) Build payload (keep structure aligned with frontend)
$updateBody = @{
    name = "Zhang San"
    gender = "Female"
    age = 32
    ethnicity = "Han"
    nativePlace = "Beijing"
    placeOfBirth = "Beijing"
    occupation = "Teacher"
    employer = "School"
    address = "Beijing"
    phone = "13800138000"

    historian = "Self"
    reliability = "Reliable"
    historianRelationship = ""

    generalInfo = @{
        admissionTime = "2026-01-30T10:00:00.000Z"
        recordTime = "2026-01-30T10:10:00.000Z"
    }

    chiefComplaint = @{
        symptom = "Fever"
        durationNum = 3
        durationUnit = "days"
        text = "Fever for 3 days, cough for 1 day"
    }

    presentIllness = @{
        onsetMode = "sudden"
        onsetTime = "3 days ago"
        trigger = "Cold exposure"
        location = "Generalized"
        quality = @("Soreness")
        severity = "moderate"
        durationDetails = "Persistent"
        factors = "Rest helps"
        treatmentHistory = "[2026-01-29] Took antipyretic, limited relief"
        associatedSymptoms = @("fever", "cough")
        associatedSymptomsDetails = "Cough and fatigue present."
        negativeSymptoms = "No chest pain, no dyspnea."
        spirit = "Fair"
        sleep = "Fair"
        appetite = "Decreased"
        strength = "Fair"
        weight = "No obvious change"
        urine_stool = "Normal"
        narrative = "Fever started 3 days ago after cold exposure, with cough; no chest pain or dyspnea."
    }

    pastHistory = @{
        generalHealth = "fair"
        pmh_diseases = @("Hypertension")
        diseaseDetails = @{
            "Hypertension" = @{
                year = 2020
                control = "Average control"
                medication = "Amlodipine"
            }
        }
        infectiousHistory = "None"
        pmh_other = "None"
        illnessHistory = ""
        surgeries = @(
            @{
                name = "Appendectomy"
                date = "2015-06"
                location = "City Hospital"
                outcome = "Recovered well"
            }
        )
        transfusions = @()
        allergies = @(
            @{
                allergen = "Penicillin"
                reaction = "Rash"
                severity = "mild"
            }
        )
        noAllergies = $false
        vaccinationHistory = "Up to date"
    }

    personalHistory = @{
        smoking_status = "Never"
        smokingHistory = "Never smoker."
        alcohol_status = "Never"
        drinkingHistory = "Never drinks alcohol."
        work_cond = "No toxin or dust exposure."
        living_habits = "Regular"
        social = "Unremarkable"
    }

    maritalHistory = @{
        status = "Married"
        marriage_age = 25
        spouse_health = "Healthy"
        children = "1 child"
    }
    menstrualHistory = @{
        age = 13
        duration = 5
        cycle = 28
        lmp_date = "2026-01-01"
        flow = "Moderate"
        pain = "None"
        isMenopause = $false
    }
    fertilityHistory = @{
        term = 1
        preterm = 0
        abortion = 0
        living = 1
        details = "2022: full-term vaginal delivery"
    }

    familyHistory = @{
        father = "Hypertension"
        mother = "Healthy"
        siblings = "Healthy"
        children = "Healthy"
        genetic = "No known hereditary disease"
        similar = "No similar disease"
        summary = "Father has hypertension; otherwise unremarkable."
    }

    reviewOfSystems = @{
        respiratory = @{
            symptoms = @("Cough")
            details = "Dry cough"
        }
    }

    physicalExam = @{
        vitalSigns = @{
            temperature = 38.2
            pulse = 90
            respiration = 20
            systolicBP = 120
            diastolicBP = 80
        }
        general = @{
            description = "Normal development, moderate nutrition, alert."
        }
        skinMucosa = "No rash"
        lymphNodes = "No palpable enlargement"
        head = "Pharyngeal congestion"
        neck = "Supple"
        chest = @{
            lungs = "Coarse breath sounds"
            heart = "Regular rhythm"
        }
        abdomen = "Soft, non-tender"
        spineLimbs = "Full range of motion"
        neurological = "No meningeal signs"
        specialist = "Not examined"
        specialistDepartment = ""
    }

    auxiliaryExams = @{
        summary = "CBC: WBC elevated"
        exams = @(
            @{
                date = "2026-01-30"
                name = "CBC"
                result = "WBC 12.0*10^9/L, neutrophils 85%"
            }
        )
    }
}

$updateJson = $updateBody | ConvertTo-Json -Depth 10

# 4) Update session
Write-Host "Updating session with full data..."
try {
    $resUpdate = Invoke-WebRequest -Uri "$baseUrl/sessions/$sessionId" -Method Patch -Body $updateJson -Headers $headers -ErrorAction Stop
    Write-Host "Update successful."
} catch {
    Write-Host "Error updating session: $_"
    Write-Host "Response: $( $_.ErrorDetails.Message )"
    exit 1
}

# 4.1) Treatment order test case 1: no reordering on server
Write-Host "Testing treatmentHistory order case 1..."
$case1Records = @(
    "[2026-01-03] at123;plan:abx_no_improve",
    "[2026-01-01] at456;plan:injection_oral_meds"
)
$case1Text = ($case1Records -join ",")
$updateBody.presentIllness.treatmentHistory = $case1Text
$updateJsonCase1 = $updateBody | ConvertTo-Json -Depth 10
try {
    Invoke-WebRequest -Uri "$baseUrl/sessions/$sessionId" -Method Patch -Body $updateJsonCase1 -Headers $headers -ErrorAction Stop | Out-Null
} catch {
    Write-Host "Error updating session (case 1): $_"
    Write-Host "Response: $( $_.ErrorDetails.Message )"
    exit 1
}
$resGetCase1 = Invoke-WebRequest -Uri "$baseUrl/sessions/$sessionId" -Method Get -Headers $headers
$objCase1 = $resGetCase1.Content | ConvertFrom-Json
$dataCase1 = Get-ResponseData $objCase1
$returnedCase1 = [string]$dataCase1.presentIllness.treatmentHistory
$md5Submit1 = Get-StringMD5 $case1Text
$md5Return1 = Get-StringMD5 $returnedCase1
if ($md5Submit1 -eq $md5Return1 -and $returnedCase1 -eq $case1Text) {
    Write-Host "[PASS] treatmentHistory order case 1 preserved. md5=$md5Return1"
} else {
    Write-Host "[FAIL] treatmentHistory order case 1 mismatch."
    Write-Host "Submit: $case1Text"
    Write-Host "Return: $returnedCase1"
    Write-Host "MD5 submit=$md5Submit1 return=$md5Return1"
}

# 4.2) Treatment order test case 2: simulate manual reorder then submit
Write-Host "Testing treatmentHistory order case 2..."
$case2Records = @(
    $case1Records[1],
    $case1Records[0]
)
$case2Text = ($case2Records -join ",")
$updateBody.presentIllness.treatmentHistory = $case2Text
$updateJsonCase2 = $updateBody | ConvertTo-Json -Depth 10
try {
    Invoke-WebRequest -Uri "$baseUrl/sessions/$sessionId" -Method Patch -Body $updateJsonCase2 -Headers $headers -ErrorAction Stop | Out-Null
} catch {
    Write-Host "Error updating session (case 2): $_"
    Write-Host "Response: $( $_.ErrorDetails.Message )"
    exit 1
}
$resGetCase2 = Invoke-WebRequest -Uri "$baseUrl/sessions/$sessionId" -Method Get -Headers $headers
$objCase2 = $resGetCase2.Content | ConvertFrom-Json
$dataCase2 = Get-ResponseData $objCase2
$returnedCase2 = [string]$dataCase2.presentIllness.treatmentHistory
$md5Submit2 = Get-StringMD5 $case2Text
$md5Return2 = Get-StringMD5 $returnedCase2
if ($md5Submit2 -eq $md5Return2 -and $returnedCase2 -eq $case2Text) {
    Write-Host "[PASS] treatmentHistory order case 2 preserved. md5=$md5Return2"
} else {
    Write-Host "[FAIL] treatmentHistory order case 2 mismatch."
    Write-Host "Submit: $case2Text"
    Write-Host "Return: $returnedCase2"
    Write-Host "MD5 submit=$md5Submit2 return=$md5Return2"
}

# 5) Fetch session and validate
Write-Host "Verifying data persistence..."
$resGet = Invoke-WebRequest -Uri "$baseUrl/sessions/$sessionId" -Method Get -Headers $headers
$sessionData = $resGet.Content | ConvertFrom-Json
$data = Get-ResponseData $sessionData

# 5.1) Verify mapping endpoint payload shape
Write-Host "Fetching mapping/symptoms..."
$resMap = Invoke-WebRequest -Uri "$baseUrl/mapping/symptoms" -Method Get -Headers $headers -ErrorAction Stop
$mapObj = $resMap.Content | ConvertFrom-Json
$mapData = Get-ResponseData $mapObj
if ($mapData -and $mapData.nameToKey) {
    Write-Host "[PASS] mapping/symptoms includes nameToKey"
} else {
    Write-Host "[FAIL] mapping/symptoms missing nameToKey"
}

# Auxiliary exams
if ($data.auxiliaryExams.exams[0].name -eq "CBC") {
    Write-Host "[PASS] Auxiliary exams saved."
} else {
    Write-Host "[FAIL] Auxiliary exams mismatch."
}

# Past history
if ($data.pastHistory.pmh_diseases -contains "Hypertension") {
    Write-Host "[PASS] Past history diseases saved."
} else {
    Write-Host "[FAIL] Past history diseases mismatch."
}

# Fertility history
if ($data.fertilityHistory.term -eq 1) {
    Write-Host "[PASS] Fertility history saved."
} else {
    Write-Host "[FAIL] Fertility history mismatch."
}

# Family history
if ($data.familyHistory.father -eq "Hypertension") {
    Write-Host "[PASS] Family history saved."
} else {
    Write-Host "[FAIL] Family history mismatch."
}

Write-Host "Full flow test completed."
