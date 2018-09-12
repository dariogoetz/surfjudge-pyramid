(function($, undefined){
    $.widget('surfjudge.judge_panel', {
        options: {
            heat_id: null,
            judge_id: null,
            heat_data: null,
            score_data: null,
        },

        _create: function(){
            this._init_html();

            this.heat_data = this.options.heat_data || {};
            this.score_data = this.options.score_data || {};

            this._register_events();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = $([
                '<table class="table table-bordered judging_table">',
                '</table>',
            ].join(' '));

            this.element.append(html);
        },

        refresh: function(){
            var _this = this;
            if (this.options.heat_data == null){
                // only retrieve heat info, if it is not provided (because get_heat_info requires admin rights)
                var deferred_heat = $.getJSON('/do_get_heat_info', {heat_id: this.options.heat_id});
            } else {
                var deferred_heat = $.Deferred().resolve([this.options.heat_data]).promise();
            }
            var deferred_scores = $.getJSON('/do_query_scores', {heat_id: this.options.heat_id});

            var deferred = $.Deferred();
            $.when(deferred_heat, deferred_scores).done(function(heat_data, score_data){
                _this.heat_data = heat_data[0];
                _this.score_data = score_data[0];

                _this._refresh();
                deferred.resolve();
            })
                .fail(function(){
                    console.log('Connection error');
                });
            return deferred.promise();
        },

        _refresh: function(){
            this._init_judging_table();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .init_score_entry': function(ev){
                    var data = $(ev.currentTarget).data();
                    this._init_edit_score_modal(data['id'], data['wave'], data['color_hex']);
                },
            });
        },

        _init_judging_table: function(){
            var _this = this;
            var n_waves = this.heat_data['number_of_waves'];
            var table_elem = this.element.find('.judging_table');
            table_elem.empty();

            var best_waves = this._get_best_waves();

            // table header
            var table_header = $('<thead class="thead-dark">');
            var header_row = $('<tr>');
            header_row.append('<td><b>Wave</b></td>');
            for (var i = 0; i < n_waves; i++){
                header_row.append($('<td>').text(i+1));
            }
            table_header.append(header_row);
            table_elem.append(table_header)

            table_body = $('<tbody>');
            // table body
            $.each(this.heat_data['participants'], function(idx, participant){
                var trow = $('<tr>');
                // surfer identifier (first column)
                var index_elem = $('<button>', {
                    class: "btn btn-default btn-lg btn-block init_score_entry",
                    style: "background-color: " + participant['surfer_color_hex'] + "; border-color: #000000; height: 70px;",
                    data: {id: participant['surfer_id'], wave: -1, color_hex: participant['surfer_color_hex']}
                })
                    .append($('<b>').text(participant['surfer_color']));

                // add index column to row
                trow.append($('<td>').append(index_elem));

                // individual waves
                for (var wave = 0; wave < n_waves; wave++){
                    // generate score element
                    var score_cell = $('<td>').addClass('score_elem init_score_entry');
                    score_cell.data({id: participant['surfer_id'], wave: wave, color_hex: participant['surfer_color_hex']});

                    // mark best / inactive
                    var participant_scores = _this.score_data[participant['surfer_id']] || [];
                    if (wave == best_waves[participant['surfer_id']]['wave'])
                        score_cell.addClass('best_wave');
                    else if (wave > participant_scores.length)
                        score_cell.addClass('inactive');
                    else if (wave == participant_scores.length)
                        score_cell.addClass('next_wave');

                    if (wave <= participant_scores.length)
                        score_cell.addClass('init_score_entry');

                    // insert score value
                    var score_val = $([
                        '<div class="text-center">'
                    ].join(' '))
                    var score = participant_scores[wave] || {};
                    if (score['missed'])
                        score_val.text('M');
                    else if (score['interference'])
                        score_val.text('M');
                    else if ('score' in score)
                        score_val.text(score['score'].toFixed(1));
                    // add column to row
                    trow.append(score_cell.append(score_val));
                }
                table_body.append(trow);
            });
            table_elem.append(table_body);
        },

        _get_best_waves: function(){
            var best_waves = {};
            $.each(this.heat_data['participants'], function(idx, participant){
                best_waves[participant['surfer_id']] = {};
            });
            $.each(this.score_data, function(surfer_id, scores){
                var best_wave = {};
                $.each(scores, function(idx, score){
                    if (!score['missed'] && !score['interference'])
                        if (score['score'] > (best_wave['score'] || -1))
                            best_wave = score;
                });
                best_waves[surfer_id] = best_wave;
            });
            return best_waves;
        },


        _init_edit_score_modal: function(surfer_id, wave, color_hex){
            var _this = this;
            var participant_scores = this.score_data[surfer_id] || [];
            if (wave < 0)
                wave = participant_scores.length;

            if (wave > participant_scores.length)
                return;

            var bb = bootbox.dialog({
                closeButton: false,
                message: '<div class="edit_score"></div>',
                size: 'large',
            });
            bb.init(function(){
                var edit_score_elem = bb.find('.edit_score');
                edit_score_elem.edit_score({
                    heat_id: _this.options.heat_id,
                    judge_id: _this.options.judge_id,
                    surfer_id: surfer_id,
                    wave: wave,
                    old_score: participant_scores[wave] || null,
                    background_color: color_hex,
                });

                edit_score_elem.on('edit_scorecancelled', function(){
                    bootbox.hideAll();
                    _this.refresh();
                });
                edit_score_elem.on('edit_scoresubmitted', function(){
                    bootbox.hideAll();
                    _this.refresh();
                });
            });
        },

        get_judge: function(){
            var _this = this;
            if (this.options.judge_id === null)
                return {};
            var res = {};
            $.each(this.heat_data['judges'], function(idx, judge){
                if (judge['id'] === _this.options.judge_id){
                    res = judge;
                    return;
                }
            });
            return res;
        },

    });

}(jQuery));
