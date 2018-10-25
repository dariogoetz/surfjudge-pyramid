(function($, undefined){
    $.widget('surfjudge.results_table', {
        options: {
            heat_id: null,
            getresultsurl: '/rest/results',
            getheaturl: '/rest/heats',
            get_participants: '/rest/participants',
        },

        _create: function(){
            this.results = [];
            this.heat = {};

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
            $.get(this.options.getresultsurl + '/' + this.options.heat_id)
                .done(function(data){
                    _this.results = data;
                    deferred_results.resolve();
                })
                .fail(function(){
                    console.log('Could not read results.');
                    deferred_results.resolve();
                });
            var deferred_heat = $.Deferred();
            $.get(this.options.getheaturl + '/' + this.options.heat_id)
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

            // prepare score data
            var surfer_scores = new Map();
            var max_n_waves = 0;
            $.each(this.results, function(idx, s){
                surfer_scores.set(s['surfer_id'], s);
                max_n_waves = Math.max(max_n_waves, surfer_scores.get(s['surfer_id'])['wave_scores'].length);
            });

            // sort participants array
            this.heat['participations'].sort(function(a,b){
                var score_a = surfer_scores.get(a['surfer_id']) || {};
                var score_b = surfer_scores.get(b['surfer_id']) || {};
                return score_a['total_score'] < score_b['total_score'];
            });

            // write table header
            var header = $('<thead>');
            var row = $('<tr>', {style: "font-weight: bold; font-size: 2em; background-color: #EEEEEE;"})
                .append($('<td>', {text: 'Place'}))
                .append($('<td>', {text: 'Surfer'}))
                .append($('<td>', {text: 'Total Score'}));
            for (var i = 0; i < max_n_waves; i++){
                row.append($('<td>', {text: 'Wave ' + (i+1)}));
            };
            header.append(row);

            // write table body
            var body = $('<tbody>');
            $.each(this.heat['participations'] || [], function(idx, participation){
                var sid = participation['surfer_id'];
                var result_data = surfer_scores.get(sid) || {'total_score': 0, 'wave_scores': []};
                var row = $('<tr>', {style: " background-color: " + participation['surfer_color_hex']})
                    .append($('<td>', {
                        text: (idx + 1) + '.',
                        style: "font-size: 2em; font-weight: bold; text-align: center;"
                    }))
                    .append($('<td>', {
                        html: participation['surfer']['first_name'] + ' ' + participation['surfer']['last_name'],
                        style: "font-size: 2em; font-weight: bold;"
                    }))
                    .append($('<td>', {
                        text: result_data['total_score'].toFixed(1),
                        style: "font-size: 2em; font-weight: bold;"
                    }));
                for (var i = 0; i < max_n_waves; i++){
                    // var score = result_data['wave_scores'][i]['score'];
                    var score = result_data['wave_scores'].filter(function(s){
                        return (s['wave'] == i);
                    })[0] || null;
                    var val = '';
                    var classes = '';
                    if (score !== null){
                        if (score['unpublished']){
                            classes += 'unpublished';
                        }
                        val = score['score'] < 0 ? 'M' : score['score'].toFixed(1)
                    }
                    row.append($('<td>', {
                        text: val,
                        class: classes,
                        style: "font-size: 2em;"
                    }));
                };
                body.append(row);
            });

            this.element.find('.results_table').append(header).append(body);
        },
    });
}(jQuery));
