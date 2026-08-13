{{/*
Expand the name of the chart.
*/}}
{{- define "aoc-orchestration.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "aoc-orchestration.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Common labels applied to all objects
*/}}
{{- define "aoc-orchestration.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "aoc-orchestration.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Engine selector labels
*/}}
{{- define "aoc-orchestration.engine.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aoc-orchestration.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: engine
{{- end -}}

{{/*
Broker selector labels
*/}}
{{- define "aoc-orchestration.broker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aoc-orchestration.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: broker
{{- end -}}

{{/*
Daemon selector labels
*/}}
{{- define "aoc-orchestration.daemon.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aoc-orchestration.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: daemon
{{- end -}}