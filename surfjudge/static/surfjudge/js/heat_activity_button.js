(function($, undefined){
    $.widget('surfjudge.heat_activity_button', {
        options: {
            heat_id: null,

            button_text_active: "Stop Heat",
            button_text_inactive: "Start Heat",
            button_text_paused: "Continue",
            button_text_unpaused: "Pause",

            heat_state: null,

            getheatstate: '/rest/heat_state/{heatid}',
            poststartheaturl: '/rest/start_heat',
            poststopheaturl: '/rest/stop_heat',
            postpauseheaturl: '/rest/toggle_heat_pause/{heatid}'
        },

        _create: function(){
            this._heat_state = this.options.heat_state;

            this._init_html();
            this._register_events();
            this._initialized = this.refresh();
        },

        _destroy: function(){
            this.element.empty();
        },

        _init_html: function(){
            var _this = this;
            var html = this._buttons_when_undefined();
            this.element.append(html);
        },

        load: function(state){
            // refresh using provided data
            this._heat_state = state;
            this._refresh();
        },

        refresh: function(){
            // load data from server and refresh
            var _this = this;
            var deferred = $.Deferred();
            $.getJSON(this.options.getheatstate.format({heatid: this.options.heat_id}), function(state){
                _this._heat_state = state['state'] || null;
                _this._refresh();
                deferred.resolve();
            });
            return deferred.promise();
        },

        _refresh: function(){
            // refresh visualization and internal state
            this._visualize_heat_status();
        },

        _register_events: function(){
            this._on(this.element, {
                'click .heat_activity_btn': this.toggle_heat_activity,
                'click .heat_pause_btn': this.toggle_pause_heat,
            })
        },

        _visualize_heat_status: function(){
            var elem = this.element;
            elem.empty();
            var html = this._buttons_when_undefined();
            if (this._heat_state === 'active') {
                html = this._buttons_when_active();
            } else if (this._heat_state === 'inactive') {
                html = this._buttons_when_inactive();
            } else if (this._heat_state === 'paused') {
                html = this._buttons_when_paused();
            }
            elem.append(html);
        },

        _buttons_when_undefined: function(){
            var html = $([
                '<div class="heat_activity">',
                '  <button class="btn btn-default btn-lg heat_activity_btn"></button>',
                '</div>',
            ].join(' '));
            html.find('button').text('Start/Stop Heat');
            return html;
        },

        _buttons_when_active: function(){
            var html = $([
                '<div class="btn-group heat_activity">',
                '  <button class="btn btn-danger btn-lg heat_activity_btn"></button>',
                '  <button class="btn btn-default btn-lg heat_pause_btn"></button>',
                '</div>',
            ].join(' '));
            html.find('button.heat_activity_btn').text(this.options.button_text_active);
            html.find('button.heat_pause_btn').text(this.options.button_text_unpaused);
            return html;
        },
        _buttons_when_inactive: function(){
            var html = $([
                '<div class="heat_activity">',
                '  <button class="btn btn-success btn-lg heat_activity_btn"></button>',
                '</div>',
            ].join(' '));
            html.find('button').text(this.options.button_text_inactive);
            return html;
        },
        _buttons_when_paused: function(){
            var html = $([
                '<div class="btn-group heat_activity">',
                '  <button class="btn btn-danger btn-lg heat_activity_btn"></button>',
                '  <button class="btn btn-default btn-lg heat_pause_btn"></button>',
                '</div>',
            ].join(' '));
            html.find('button.heat_activity_btn').text(this.options.button_text_active);
            html.find('button.heat_pause_btn').text(this.options.button_text_paused);
            return html;
        },

        toggle_heat_activity: function(){
            if ((this._heat_state === 'active') || (this._heat_state === 'paused'))
                this.deactivate_heat();
            else if (this._heat_state === 'inactive')
                this.activate_heat();
        },

        activate_heat: function(){
            var _this = this;
            $.post(this.options.poststartheaturl, JSON.stringify({heat_id: this.options.heat_id}))
                .done(function(){
                    _this._heat_state = 'active';
                    _this._visualize_heat_status();
                    _this.refresh();
                    _this._trigger('heat_activity_changed', null);
                });
        },

        toggle_pause_heat: function(){
            var _this = this;
            $.post(this.options.postpauseheaturl.format({heatid: this.options.heat_id}))
                .done(function(){
                    _this.refresh();
                    _this._trigger('heat_activity_changed', null);
                });
        },
        pause_heat: function(){},
        unpause_heat: function(){},

        deactivate_heat: function(){
            var _this = this;
            $.post(this.options.poststopheaturl, {heat_id: this.options.heat_id})
                .done(function(){
                    _this._heat_state = 'inactive';
                    _this._visualize_heat_status();
                    _this.refresh();
                    _this._trigger('heat_activity_changed', null);
                });
        },

        heat_is_active: function(){
            return (this._heat_state === 'active') || (this._heat_state === 'paused');
        },

        initialized: function(){
            return this._initialized;
        },
    });

}(jQuery));
