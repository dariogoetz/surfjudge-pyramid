(function($, undefined){
    $.widget('surfjudge.edit_score', {
        options: {
            heat_id: null,
            judge_id: null,
            surfer_id: null,
            wave: null,
            old_score: null,
            background_color: null,
            delete_allowed: false,
        },

        _create: function(){

            this._init_html();

            this.data = this.options.data;
            this.score = null;

            this._register_events();
            this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            html = $([
                '<table class="table borderless">',
                '    <tr>',
                '        <td style="width: 10%">',
                '            <div class="wave_label"> Wave <span class="wave_number"></span></div>',
                '            <br>',
                '        </td>',
                '',
                '',
                '        <td rowspan="3" width="5%"></td>',
                '        <td rowspan="3" bgcolor="#EEEEEE">',
                '<table class="table table-bordered">',
                '    <tbody>',
                '        <tr style="height: 100px;">',
                '            <td class="text-center number_btn" data-value="1">1</td>',
                '            <td class="text-center number_btn" data-value="2">2</td>',
                '            <td class="text-center number_btn" data-value="3">3</td>',
                '        </tr>',
                '        <tr style="height: 100px;">',
                '            <td class="text-center number_btn" data-value="4">4</td>',
                '            <td class="text-center number_btn" data-value="5">5</td>',
                '            <td class="text-center number_btn" data-value="6">6</td>',
                '        </tr>',
                '        <tr style="height: 100px;">',
                '            <td class="text-center number_btn" data-value="7">7</td>',
                '            <td class="text-center number_btn" data-value="8">8</td>',
                '            <td class="text-center number_btn" data-value="9">9</td>',
                '        </tr>',
                '        <tr style="height: 100px;">',
                '            <td></td>',
                '            <td class="text-center number_btn" data-value="0">0</td>',
                '            <td></td>',
                '        </tr>',
                '    </tbody>',
                '</table>',
                '        </td>',
                '        <td rowspan="3" width="5%">',
                '        </td>',
                '',
                '        <td bgcolor="#EEEEEE" style="width: 10%; border-radius: 5px 5px 0px 0px">',
                '            <button class="btn btn-secondary btn-lg cancel_btn" style="width: 100%; height: 70px;">Cancel</button>',
                '        </td>',
                '    </tr>',
                '    <tr>',
                '        <td align="center" bgcolor="#EEEEEE">',
                '                <h4 style="display:none;" align="center">',
                '                    <font color="red">Old:</font>',
                '                    <span class="old_score"></span>',
                '                </h4>',
                '                <h1>',
                '                    <span class="new_score" style="display:none">New:<br></span>',
                '                    <span class="score" align="center">--</span>',
                '                </h1>',
                '        </td>',
                '',
                '        <td bgcolor="#EEEEEE" style="vertical-align: middle; border-radius: 0px 0px 0px 0px">',
                '            <button class="btn btn-info btn-lg clear_btn" style="width: 100%; height: 70px;">Clear</button>',
                '        </td>',
                '    </tr>',
                '    <tr>',
                '        <td style="vertical-align: bottom">',
                '            <button class="btn btn-standard btn-lg missed_btn" style="height:70px; width: 120px; vertical-align: bottom;">Missed</button>',
                '        </td>',
                '        <td bgcolor="#EEEEEE" style="vertical-align: bottom; border-radius: 0px 0px 5px 5px">',
                '            <button class="btn btn-success btn-lg submit_btn" style="width: 100%; height: 70px;">Enter</button>',
                '        </td>',
                '    </tr>',
                '</table>',
            ].join(' '));

            html.find('.wave_number').text(this.options.wave + 1);
            this.element.append(html);
            if (this.options.background_color != null)
                this.element.find('table').css({'background-color': this.options.background_color});
        },

        refresh: function(){
            this._refresh();
        },

        _refresh: function(){
            // fill score field
            var score_elem = this.element.find('.score');
            if (this.score === null)
                score_elem.text('--');
            else if (this.score['missed'])
                score_elem.text('M');
            else if (this.score['interference'])
                score_elem.text('I');
            else if (this.score['score'] >= 0)
                score_elem.text(this.score['score'].toFixed(1));

            // fill old score field, if applicable
            var old_score = this.options.old_score;
            if (old_score != null || !$.isEmptyObject(old_score)){
                var old_score_elem = this.element.find('.old_score');
                if (old_score['missed'])
                    old_score_elem.text('M');
                else if (old_score['interference'])
                    old_score_elem.text('I');
                else
                    old_score_elem.text(old_score['score'].toFixed(1));
                this.element.find('.old_score').parent().show();
            }

            this._update_submit_btn_state();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .number_btn': function(ev){this.enter_digit(parseInt($(ev.currentTarget).data('value')))},
                'click .missed_btn': this.enter_missed,
                'click .clear_btn': this.clear,
                'click .cancel_btn': this.cancel,
                'click .submit_btn': this.upload,
                'click .delete_btn': this.delete,
            });
        },

        _update_submit_btn_state: function(){
            var submit_btn = this.element.find('.submit_btn');
            if (this.options.delete_allowed && this.score === null){
                submit_btn
                    .text('Delete')
                    .removeClass('btn-primary disabled')
                    .addClass('btn-danger');
            } else if (this.score === null){
                submit_btn
                    .text('Enter')
                    .removeClass('btn-danger')
                    .addClass('btn-primary disabled');
            } else {
                submit_btn
                    .text('Enter')
                    .removeClass('btn-danger disabled')
                    .addClass('btn-primary');
            }
        },

        delete: function(){
            var _this = this;
            if (this.options.delete_allowed){
                var upload_data = {
                    heat_id: this.options.heat_id,
                    judge_id: this.options.judge_id,
                    score: JSON.stringify({surfer_id: this.options.surfer_id,
                                           wave: this.options.wave}),
                    };
                $.post('/tournament_admin/do_delete_score', upload_data, function(res){
                    console.log('deleted score');
                    _this._trigger('submitted');
                });
            };
        },

        upload: function(){
            var _this = this;
            if (this.score == null){
                if (this.options.delete_allowed){
                    _this.delete();
                }
                return;
            }

            var upload_data = {
                heat_id: this.options.heat_id,
                judge_id: this.options.judge_id,
                score: JSON.stringify({surfer_id: this.options.surfer_id,
                                       score: this.score['score'],
                                       wave: this.options.wave,
                                       missed: this.score['missed'],
                                       interference: this.score['interference']}),
            };
            $.post('/do_insert_score', upload_data, function(data){
                console.log('uploaded');
            });
            _this._trigger('submitted');
        },

        enter_digit: function(val){
            var new_score = this.score || {};
            
            //// If score is already set to "missed" or "interference" don't react on key input
            if (this.score !== null && (this.score['missed'] || this.score['interference'])){
                return;
            }
            
            //// If no score exists yet, asign keypad input to score
            //// the counter counts how many digits the user enters            
            if (this.score === null){
                new_score['score'] = val;
                this.score={};
                this.score['counter']=1;
            }
            
            //// If last digits was a 1 and current digit is 0 then save a 10
            else if (this.score['score'] == 1 && val == 0){
                new_score['score'] = 10;
            }
            
            //// In all other cases append the digit as in a calculator if user is entering first or second digit.
            //// If user enter third or more digit ignore input
            else if (this.score['counter'] < 2){
                    new_score['score'] = this.score['score'] + 0.1 * val;
                    this.score['counter'] = this.score['counter']+1;
            }
            else{
                    return;
            }
            
            //// If user has entered 1 and 0 which gives 10 and tries to enter a third digit (to obtain 10.1 or so) reset input
            if (new_score['score'] > 10){
                new_score['score'] = null;
            }
            
            if (new_score['score'] !== null){
                this.score = {counter: this.score['counter'], score: new_score['score'], missed: false, interference: false};
            }
            
            else{
                this.score = null;
            }
            
            this._refresh();
        },

        clear: function(){
            this.score = null;
            this._refresh();
        },

        enter_missed: function(){
            this.score = {score: -1, missed: true, interference: false};
            this._refresh();
        },

        cancel: function(){
            this._trigger('cancelled');
        },

    });

}(jQuery));
