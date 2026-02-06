# 修复前端文件中的乱码字符
# 使用 UTF-8 编码读取和写入文件

$files = @(
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Editor\MaritalHistorySection.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Editor\PersonalHistorySection.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Assistant\AssistantOverlay.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Knowledge\IntelligentKnowledgeBase.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Knowledge\KnowledgePanel.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Assistant\KnowledgeTab.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Editor\HPISection.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Diagnosis\EnhancedDiagnosisPanel.tsx",
    "d:\医学生智能问诊辅助系统（MSIA）\client\src\pages\Interview\components\Editor\GeneralSection.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing: $file"
        $content = Get-Content -Path $file -Raw -Encoding UTF8

        # 修复常见的乱码模式
        # 注意：这里使用正则表达式来匹配乱码字符
        # 由于乱码字符在 PowerShell 中可能无法正确显示，我们使用字节模式

        # 将内容转换为字节数组
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)

        # 查找并替换乱码字节序列 (EF BF BD 是 � 的 UTF-8 编码)
        $newBytes = New-Object System.Collections.Generic.List[System.Byte]
        $i = 0
        while ($i -lt $bytes.Length) {
            # 检查是否是 � (EF BF BD)
            if ($i + 2 -lt $bytes.Length -and
                $bytes[$i] -eq 0xEF -and
                $bytes[$i+1] -eq 0xBF -and
                $bytes[$i+2] -eq 0xBD) {
                # 跳过这个乱码字符（或替换为空格）
                # 这里我们选择跳过，因为无法确定原始字符是什么
                $i += 3
            } else {
                $newBytes.Add($bytes[$i])
                $i++
            }
        }

        # 将字节数组转换回字符串
        $newContent = [System.Text.Encoding]::UTF8.GetString($newBytes.ToArray())

        # 写入文件
        Set-Content -Path $file -Value $newContent -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $file"
    } else {
        Write-Host "File not found: $file"
    }
}

Write-Host "All files processed!"
