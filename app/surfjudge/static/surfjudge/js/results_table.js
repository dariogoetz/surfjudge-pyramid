(function($, undefined){
    $.widget('surfjudge.results_table', {
        options: {
            heat_id: null,
            getresultsurl: '/rest/results/{heatid}',
            getheaturl: '/rest/heats/{heatid}',

            websocket_url: null,
            websocket_channels: ['results'],
        },

        _create: function(){
            var _this = this;
            this.results = [];
            this.heat = {};

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

            this._init_html();
	        this._register_events();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            var html = $([
                '<table class="table results_table"></table>',
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

            var needs_first = this._compute_needs(sorted_total_scores[0] || 0);
            var needs_second = this._compute_needs(sorted_total_scores[1] || 0);
            var best_waves = this._compute_best_waves();

            // sort participants array
            this.heat['participations'].sort(function(a,b){
                // sort in first order by total score
                // if total score is same, order by best wave
                var score_a = surfer_scores.get(a['surfer_id']) || {};
                var score_b = surfer_scores.get(b['surfer_id']) || {};
                if (score_a['total_score'] != score_b['total_score']) {
                    return score_b['total_score'] - score_a['total_score'];
                }
                var bw_a = best_waves.get(a['surfer_id']) || {};
                var bw_b = best_waves.get(b['surfer_id']) || {};
                return bw_b[0]['score'] - bw_a[0]['score'];
            });

            // write table header
            var header = $('<thead>');
            var row = $('<tr>', {style: "font-weight: bold; font-size: 2em; background-color: #EEEEEE;"})
                .append($('<td>', {html: 'Place'}))
                .append($('<td>', {html: 'Surfer'}))
                .append($('<td>', {html: 'Score'}))
                .append($('<td>', {html: 'Needs <br> 1st/2nd'}));

            for (var i = 0; i < max_n_waves; i++){
                row.append($('<td>', {text: 'Wave ' + (i+1)}));
            };
            header.append(row);

            // write table body
            var body = $('<tbody>');

            // after foregoing code, this.heat['participations'] is sorted by total score
            var previous_place = 1;
            var previous_score = null;
            $.each(this.heat['participations'] || [], function(idx, participation){
                var sid = participation['surfer_id'];

                // compile string for needs cell
                var nf = needs_first.get(sid);
                var ns = needs_second.get(sid);
                var needs_str = "{nf} / {ns}".format({
                    nf: nf < 0 ? '-' : nf.toFixed(1),
                    ns: ns < 0 ? '-' : ns.toFixed(1),
                });

                var result_data = surfer_scores.get(sid) || {'total_score': 0, 'wave_scores': []};

                // give participants with same total score the same place (TODO: check if this is possible or best wave is second criterion)
                var place = idx + 1;
                if (previous_score == result_data['total_score']) {
                    // same score as previous participant --> gets same place
                    place = previous_place;
                } else {
                    // higher score than last participant; store place and score for next participant
                    previous_place = place;
                    previous_score = result_data['total_score'];
                }
                var row = $('<tr>', {
                    style: "background-color: " + participation['surfer_color_hex'],
                    class: "surfer_{0}".format(sid),
                })
                    .append($('<td>', {
                        text: place + '.',
                        style: "font-size: 2em; font-weight: bold; text-align: center;"
                    }))
                    .append($('<td>', {
                        html: participation['surfer']['first_name'] + ' ' + participation['surfer']['last_name'],
                        style: "font-size: 2em; font-weight: bold;"
                    }))
                    .append($('<td>', {
                        text: result_data['total_score'].toFixed(1),
                        style: "font-size: 2em; font-weight: bold; text-align: center;"
                    }))
                    .append($('<td>', {
                        text: needs_str,
                        style: "font-size: 2em; text-align: center;"
                    }));
                for (var i = 0; i < max_n_waves; i++){
                    // var score = result_data['wave_scores'][i]['score'];
                    var score = result_data['wave_scores'].filter(function(s){
                        return (s['wave'] == i);
                    })[0] || null;
                    var val = '';
                    var classes = ['wave_{0}'.format(i)];
                    if (score !== null){
                        if (score['unpublished']){
                            classes.push('unpublished');
                        }
                        val = score['score'] < 0 ? 'M' : score['score'].toFixed(1)
                    }
                    row.append($('<td>', {
                        text: val,
                        class: classes.join(' '),
                        style: "font-size: 2em; text-align: center;"
                    }));
                };
                body.append(row);
            });

            this.element.find('.results_table').append(header).append(body);
            
            this._mark_best_waves(best_waves);
        },

        _mark_best_waves: function(best_waves){
            var _this = this;
            best_waves.forEach(function(data, surfer_id){
                var selector = '.surfer_{0} .wave_{1}'.format(surfer_id, data[0]['wave']);
                _this.element.find(selector).addClass('best_wave');
                var selector = '.surfer_{0} .wave_{1}'.format(surfer_id, data[1]['wave']);
                _this.element.find(selector).addClass('second_best_wave');
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

        _compute_needs: function(target_total_score) {
            // round value to two decimals and add 0.01
            var exceed_round = function(val) {
                return Math.round((val) * 10) / 10 + 0.1;
            };
            // initialize needs with target_total_score
            // also for participants, that do not appear in this.results, yet
            var needs = new Map();
            $.each(this.heat['participations'], function(idx, part){
                var need = target_total_score > 0 ? exceed_round(target_total_score) : -1;
                needs.set(part['surfer_id'], need);
            });

            // needs for surfer i is
            // round_2_decimals(target_total_score - best_wave(i) + 0.01)
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
                    var need = exceed_round(target_total_score - bw['score']);                // save best wave
                    needs.set(surfer['surfer_id'], need);
                }
            });
            return needs;
        },
    });
}(jQuery));
