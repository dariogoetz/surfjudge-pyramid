(function($, undefined){
    $.widget('surfjudge.edit_scores_panel', {
        options: {
            heat_id: null,
            data: null,

            getlycracolorsurl: '/rest/lycra_colors',
            getheatsurl: '/rest/heats',
            getparticipantsurl: '/rest/participants',
            getscoresurl: '/rest/scores',
        },

        _create: function(){
            var _this = this;

            this.data = null;
            this.participant_info = null;
            this.color_map = null;

            this._init_html();
            this._register_events();

            if (this.options.data !== null){
                this.initialized = this.load(this.options.data);
            } else {
                this.initialized = this.refresh();
            }
            this.initialized.done(function(){
            });
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = $([
                '<table class="table table-bordered">',
                '</table>',
            ].join(' '));

            this.element.append(html);
        },

        load: function(data_heat, data_participants, data_scores, data_colors){
            var _this = this;
            var deferred = $.Deferred();
            this.data = data_heat;

            this.participant_info = new Map();
            $.each(data_participants, function(idx, p){
                _this.participant_info.set(parseInt(p['surfer_id']), p);
            });

            this.color_map = new Map();
            $.each(data_colors, function(idx, c){
                _this.color_map.set(c['COLOR'], c);
            });

            this.scores = [];
            $.each(data_scores, function(judge_id_str, judge_scores){
                $.each(judge_scores, function(surfer_id_str, surfer_scores){
                    $.each(surfer_scores, function(idx, score){
                        _this.scores.push(score);
                    });
                });
            });

            this._refresh();
            deferred.resolve();
            return deferred.promise();
        },

        refresh: function(options){
            var _this = this;
            // load data from server and refresh
            var deferred = $.Deferred();

            var def_heat = $.Deferred();
            $.getJSON(this.options.getheatsurl + '/' + this.options.heat_id)
                .done(function(data){def_heat.resolve(data);})
                .fail(function(){
                    console.log('Failed to load heat data');
                    def_heat.resolve();
                });
            var def_part = $.Deferred();
            $.getJSON(this.options.getparticipantsurl + '/' + this.options.heat_id)
                .done(function(data){def_part.resolve(data);})
                .fail(function(){
                    console.log('Failed to load participants data');
                    def_part.resolve();
                });
            var def_scores = $.Deferred();
            $.getJSON(this.options.getscoresurl, {heat_id: this.options.heat_id, get_for_all_judges: 1})
                .done(function(data){def_scores.resolve(data);})
                .fail(function(){
                    console.log('Failed to load scores data');
                    def_scores.resolve();
                });
            var def_colors = $.Deferred();
            $.getJSON(this.options.getlycracolorsurl)
                .done(function(data){def_colors.resolve(data);})
                .fail(function(){
                    console.log('Failed to load lycra color data');
                    def_colors.resolve();
                });
            $.when(def_heat, def_part, def_scores, def_colors)
                .done(function(data_heat, data_part, data_scores, data_colors){
                    _this.colors = data_colors;
                    _this.load(data_heat, data_part, data_scores, data_colors).done(function(){
                        deferred.resolve();
                    });
                });

            return deferred.promise();
        },

        _refresh: function(){
            this._init_table();
        },

        _init_table: function(){
            var _this = this;
            var table = this.element.find('table');
            table.empty();
            var header_row = $('<tr>');
            header_row.append($('<td><b>Surfer</b></td>'));
            header_row.append($('<td><b>Judge</b></td>'));
            for (var i=0; i < this.data['number_of_waves']; i++){
                header_row.append($('<td>', {class: 'text-center'})
                                  .append($('<b>')
                                          .html(i + 1)));
            }
            table.append($('<thead>').append(header_row));

            var body = $('<tbody>');
            $.each(this.data['participants'], function(idx, participant){
                $.each(_this.data['judges'], function(idx, judge){

                    var row = $('<tr>');
                    var color_str = _this.participant_info.get(participant['id'])['surfer_color'];
                    var color_hex = _this.color_map.get(color_str)['HEX'];
                    var col_options = {
                        'style': 'background-color:' + color_hex + ';',
                    };

                    // fill surfer name cell
                    row.append($('<td>', col_options)
                               .html(participant['first_name'] + ' ' + participant['last_name']));

                    // fill judge name cell
                    row.append($('<td>', col_options)
                               .html(judge['first_name'] + ' ' + judge['last_name']));

                    // filter and sort scores for surfer
                    var scores = _this._get_scores_for_surfer(judge['id'], participant['id']);

                    // fill table cell with score
                    for (var i = 0; i < _this.data['number_of_waves']; i++){
                        var score_val = '';
                        var classes = 'score_elem';
                        if (i < scores.length){
                            var score = scores[i];
                            if (score['interference'])
                                score_val = 'I';
                            else if (score['missed'])
                                score_val = 'M';
                            else
                                score_val = score['score'].toFixed(1);
                        }
                        if (i <= scores.length)
                            classes += ' editable';
                        if (i == scores.length - 1)
                            classes += ' deletable';

                        row.append($('<td>', $.extend({}, col_options, {
                            class: classes,
                            data: {judge_id: judge['id'], surfer_id: participant['id'], wave: i, color_hex: color_hex},
                        }))
                                   .html(score_val));
                    }
                    // add row to table body
                    body.append(row);
                });
            });
            table.append(body);
        },

        _get_scores_for_surfer: function(judge_id, surfer_id){
            return this.scores
                .filter(function(score){
                    return (score['surfer_id'] == surfer_id && score['judge_id'] == judge_id)
                })
                .sort(function(s1, s2){
                    return s1['wave'] - s2['wave'];
                });
        },

        _register_events: function(){
            this._on(this.element, {
                'click .score_elem': function(ev){
                    var elem = $(ev.currentTarget);
                    if (elem.hasClass('editable')){
                        var deletable = elem.hasClass('deletable');
                        var data = elem.data();
                        this._init_edit_score_modal(data['judge_id'], data['surfer_id'], data['wave'], data['color_hex'], deletable);
                    }
                },
            })
        },

        _init_edit_score_modal: function(judge_id, surfer_id, wave, color_hex, deletable){
            var _this = this;
            var participant_scores = this._get_scores_for_surfer(judge_id, surfer_id);
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
                    judge_id: judge_id,
                    surfer_id: surfer_id,
                    wave: wave,
                    old_score: participant_scores[wave] || null,
                    background_color: color_hex,
                    delete_allowed: deletable,
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
    });
}(jQuery));
