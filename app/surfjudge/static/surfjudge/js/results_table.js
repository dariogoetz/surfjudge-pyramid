(function($, undefined){
    $.widget('surfjudge.results_table', {
        options: {
            heat_id: null,
            getresultsurl: '/rest/results/{heatid}',
            getheaturl: '/rest/heats/{heatid}',

            websocket_url: null,
            websocket_channels: ['results'],

            show_header: true,
            show_wave_scores: true,
            show_needs: true,

            small: false,

            decimals: 2, // maximum (or exact) number of decimals
            fixed_decimals: true, // whether each number should have a fixed number of decimals e.g. 4.00
        },

        _create: function(){
            var _this = this;
            this.results = [];
            this.heat = {};

            if (this.options.websocket_url) {
                console.log('Initiating websocket for results table.')
                var channels = {};
                $.each(this.options.websocket_channels, function(idx, channel){
                    channels[channel] = _this.refresh.bind(_this);
                });
                this.websocket = new WebSocketClient({
                    url: this.options.websocket_url,
                    channels: channels,
                    name: 'Results Table',
                });
            }

            this._init_html();
	        this._register_events();
            this.refresh();
        },

        _destroy: function(){
            if (this.websocket != null)
                this.websocket.close();
            this.element.empty();
            },

        _init_html: function(){
            var _this = this;
            var html = $([
                '<table class="table results_table borderless"></table>',
            ].join(' '));

            this.element.append(html);
        },

	    _register_events: function(){
	    },

        refresh: function(){
            var _this = this;
            var deferred_results = $.Deferred();
            $.get(this.options.getresultsurl.format({heatid: this.options.heat_id}))
                .done(function(data){
                    _this.results = data;
                    deferred_results.resolve();
                })
                .fail(function(){
                    console.log('Could not read results.');
                    deferred_results.resolve();
                });
            var deferred_heat = $.Deferred();
            $.get(this.options.getheaturl.format({heatid: this.options.heat_id}))
                .done(function(data){
                    _this.heat = data;
                    deferred_heat.resolve();
                })
                .fail(function(){
                    console.log('Could not read heat info.');
                    deferred_heat.resolve();
                });
            var deferred = $.Deferred();
            $.when(deferred_results, deferred_heat).done(function(){
                _this._refresh();
                deferred.resolve();
            });
            return deferred.promise();
        },

        _refresh: function(){
            var _this = this;
            this.element.find('table').empty();
            if (this.options.small) {
                this.element.find('table').addClass('table-sm');
            }

            // prepare score data
            var surfer_scores = new Map();
            var max_n_waves = 0;
            $.each(this.results, function(idx, s){
                surfer_scores.set(s['surfer_id'], s);
                max_n_waves = Math.max(max_n_waves, surfer_scores.get(s['surfer_id'])['wave_scores'].length);
            });

            var sorted_total_scores = $.map(this.results, function(surfer_result){
                return parseFloat(surfer_result['total_score']);
            }).concat().sort(function(a, b){return b - a});

            var best_waves = null;

            if (this.heat.type == 'call') {
                best_waves = this._compute_best_waves_call();
            } else {
                best_waves = this._compute_best_waves();
            }

            // sort participants array
            this.heat['participations'].sort(function(a,b){
                var score_a = surfer_scores.get(a['surfer_id']) || {};
                var score_b = surfer_scores.get(b['surfer_id']) || {};
                return score_a['place'] - score_b['place'];
            });

            // write table header
            var header = $('<thead>');
            var row = $('<tr>')
                .append($('<td>', {html: '&nbsp;', class: 'color_header'}))
                .append($('<td>', {html: 'Place', class: 'place_header'}))
                .append($('<td>', {html: 'Surfer', class: 'surfer_header'}))
                .append($('<td>', {html: 'Score', class: 'score_header'}));

            if (this.options.show_needs && this.heat.type != 'call') {
                var needs_first = this._compute_needs(sorted_total_scores[0] || 0);
                var needs_second = this._compute_needs(sorted_total_scores[1] || 0);
                row.append($('<td>', {html: 'Needs <br> 1st/2nd', class: 'needs_header'}));
            }

            if (this.options.show_wave_scores) {
                for (var i = 0; i < max_n_waves; i++){
                    row.append($('<td>', {text: 'Wave ' + (i+1), class: 'wave_score_header'}));
                };
            }
            if (this.options.show_header) {
                header.append(row);
            }

            // write table body
            var body = $('<tbody>');

            // after foregoing code, this.heat['participations'] is sorted by total score
            $.each(this.heat['participations'] || [], function(idx, participation){
                var sid = participation['surfer_id'];

                if (_this.options.show_needs && _this.heat.type != 'call') {

                    // compile string for needs cell
                    var nf = needs_first.get(sid);
                    var ns = needs_second.get(sid);
                    var needs_str = "{nf} / {ns}".format({
                        nf: nf < 0 ? '-' : _this._float_str(nf),
                        ns: ns < 0 ? '-' : _this._float_str(ns),
                    });
                }
                var result_data = surfer_scores.get(sid) || {'total_score': 0, 'wave_scores': []};
                var total_score_text = '--';
                if (max_n_waves > 0) {
                    if (_this.heat.type == 'call') {
                        total_score_text = result_data['total_score'].toFixed(0);
                    } else {
                        total_score_text = _this._float_str(_this._round(result_data['total_score']));
                    }
                }

                var row = $('<tr>', {
                    class: "surfer_{0}".format(sid),
                    style: "background-color:" + lighten(participation['lycra_color']['hex']), // the last two digits are the opacity
                })
                    .append($('<td>', {
                        html: '&nbsp;&nbsp;',
                        class: 'color_cell',
                        style: "background-color:" + participation['lycra_color']['hex'] + ";",
                    }))
                    .append($('<td>', {
                        text: max_n_waves == 0 ? '--' : (result_data['place'] == null ? 1 : (result_data['place'] + 1)) + '.',
                        class: 'place_cell',
                    }))
                    .append($('<td>', {
                        html: '<span class="first_name">{first_name}</span>{line_break} <span class="last_name">{last_name}</span>'.format({
                            first_name: participation['surfer']['first_name'],
                            last_name: participation['surfer']['last_name'].toUpperCase(),
                            line_break: _this.options.small ? '' : '<br>',
                        }),
                        class: 'name_cell',
                    }))
                    .append($('<td>', {
                        text: total_score_text,
                        class: result_data['unpublished'] ? 'total_score_cell unpublished' : 'total_score_cell',
                    }));

                if (_this.options.show_needs && _this.heat.type != 'call') {
                    row.append($('<td>', {
                            text:  max_n_waves == 0 ? '--' : needs_str,
                            class: 'needs_cell',
                        }));
                }
                if (_this.options.show_wave_scores) {
                    for (var i = 0; i < max_n_waves; i++){
                        var score = result_data['wave_scores'].filter(function(s){
                            return (s['wave'] == i);
                        })[0] || null;
                        var val = '';
                        var classes = ['wave_score_cell', 'wave_{0}'.format(i)];
                        if (score !== null){
                            if (score['unpublished']){
                                classes.push('unpublished');
                            }
                                val = score['score'] < 0 ? 'M' : _this._float_str(_this._round(score['score']));
                        }
                        row.append($('<td>', {
                            text: val,
                            class: classes.join(' '),
                        }));
                    };
                }

                body.append(row);
            });

            this.element.find('.results_table').append(header).append(body);

            this._mark_best_waves(best_waves);
        },

        _round: function(val, precision) {
            if (precision == null) {
                var precision = this.options.decimals;
            }
            return (Math.round(val * 10**precision) / 10**precision);
        },

        _float_str: function(val){
            if (this.options.fixed_decimals) {
                return val.toFixed(this.options.decimals);
            } else {
                return +parseFloat(val);
            }
        },

        _mark_best_waves: function(best_waves){
            var _this = this;
            best_waves.forEach(function(scores, surfer_id){
                $.each(scores, function(idx, score){
                    var selector = '.surfer_{0} .wave_{1}'.format(surfer_id, score['wave']);
                    _this.element.find(selector).addClass('best_wave');
                });
            });
        },

        _compute_best_waves: function(){
            var best_wave = new Map();
            $.each(this.results, function(idx, surfer){
                if ((surfer['wave_scores'] || []).length == 0) {
                    best_wave.set(surfer['surfer_id'], [{score: 0, wave: -1}, {score: 0, wave: -1}]);
                }
                // sort waves for surfer by score
                var sorted_ws = (surfer['wave_scores'] || []).concat().sort(function(a, b){
                    return b['score'] - a['score'];
                });
                // get best wave of surfer
                var bw = sorted_ws[0] || {score: 0, wave: -1};
                var sbw = sorted_ws[1] || {score: 0, wave: -1};
                best_wave.set(surfer['surfer_id'], [bw, sbw]);
            });
            return best_wave;
        },

        _compute_best_waves_call: function(){
            var _this = this;
            var best_waves = new Map();
            var scores_by_wave = new Map();
            $.each(this.results, function(idx, surfer){
                $.each(surfer['wave_scores'] || [], function(widx, score){
                    var wave = score['wave'];
                    if (!scores_by_wave.has(wave)) {
                        scores_by_wave.set(wave, []);
                    }
                    scores_by_wave.get(wave).push(score);
                });
            });
            scores_by_wave.forEach(function(scores, wave){
                var best = scores.sort(function(a, b){
                    return b['score'] - a['score'];
                })[0];
                var best_val = _this._round(best['score']);
                $.each(scores, function(idx, score){
                    if (_this._round(score['score']) == best_val) {
                        var surfer_id = score['surfer_id'];
                        if (!best_waves.has(surfer_id)) {
                            best_waves.set(surfer_id, []);
                        }
                        best_waves.get(surfer_id).push(score);
                    }
                });
            });
            return best_waves;
        },

        _compute_needs: function(target_total_score) {
            var _this = this;

            // round value to two decimals and add 0.01
            var exceed_round = function(val) {
                return _this._round(val) + 1.0/(10**_this.options.decimals);
            };
            // initialize needs with target_total_score
            // also for participants, that do not appear in this.results, yet
            var needs = new Map();
            $.each(this.heat['participations'], function(idx, part){
                var need = target_total_score > 0 ? _this._round(target_total_score) : -1;
                needs.set(part['surfer_id'], need);
            });

            $.each(this.results, function(idx, surfer){
                var wave_scores = surfer['wave_scores'].concat() || [];

                // sort waves for surfer by score
                var sorted_ws = wave_scores.sort(function(a, b){
                    return b['score'] - a['score'];
                });
                // get best wave of surfer
                var bw = sorted_ws[0] || {score: 0, wave: -1};

                if (surfer['total_score'] >= target_total_score - 0.001) {
                    needs.set(surfer['surfer_id'], -1);
                } else {
                    var need = _this._round(target_total_score - bw['score']);
                    needs.set(surfer['surfer_id'], need);
                }
            });
            return needs;
        },
    });
}(jQuery));
