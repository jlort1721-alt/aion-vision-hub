// Package metrics exposes Prometheus counters/gauges for the gateway.
// All metric names are prefixed `aion_reverse_` to avoid collision with
// existing AION metrics.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Set struct {
	DevicesTotal    *prometheus.GaugeVec
	SessionsOnline  *prometheus.GaugeVec
	HeartbeatsTotal *prometheus.CounterVec
	StreamsActive   *prometheus.GaugeVec
	PTZCommands     *prometheus.CounterVec
	Errors          *prometheus.CounterVec
	LoginLatency    *prometheus.HistogramVec
}

var Default = newSet()

func newSet() *Set {
	return &Set{
		DevicesTotal: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "aion_reverse_devices_total",
			Help: "Known devices per vendor and status.",
		}, []string{"vendor", "status"}),

		SessionsOnline: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "aion_reverse_sessions_online",
			Help: "Currently online sessions per vendor.",
		}, []string{"vendor"}),

		HeartbeatsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "aion_reverse_heartbeats_total",
			Help: "Heartbeats received.",
		}, []string{"vendor"}),

		StreamsActive: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "aion_reverse_streams_active",
			Help: "Currently active reverse streams.",
		}, []string{"vendor"}),

		PTZCommands: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "aion_reverse_ptz_commands_total",
			Help: "PTZ commands dispatched.",
		}, []string{"vendor", "action"}),

		Errors: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "aion_reverse_errors_total",
			Help: "Errors by subsystem and kind.",
		}, []string{"subsystem", "kind"}),

		LoginLatency: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "aion_reverse_login_latency_seconds",
			Help:    "Vendor reverse-login latency.",
			Buckets: prometheus.DefBuckets,
		}, []string{"vendor"}),
	}
}
